/**
 * Hybrid phone voice path v3.0 — PRODUCTION HARDENED:
 *   Twilio μ-law  →  Groq Whisper (STT)  →  Groq Chat (LLM)  →  ElevenLabs TTS (ulaw_8000)  →  Twilio
 *
 * v3.0 fixes over v2.0:
 *   ✓ DTMF tone detection — no longer triggers barge-in or STT (fixes "press 1 drops call")
 *   ✓ Adaptive noise floor — calibrates to phone-line ambient noise
 *   ✓ Minimum barge-in speech duration — prevents short noise bursts from interrupting AI
 *   ✓ Less aggressive auto-hangup — requires turnCount >= 5 for soft goodbyes
 *   ✓ Faster TTS response — reduced silence prefix from 200ms to 80ms
 *   ✓ Processing race condition fix — proper cancellation token for barge-in
 *   ✓ Barge-in support (user interrupts → AI stops talking, listens)
 *   ✓ Auto-hangup after goodbye / DO_NOT_CALL
 *   ✓ Smart noise filtering (ignores "uh", "um", background noise)
 *   ✓ Conversation stage tracking (greeting → pitch → close)
 *   ✓ Action completion awareness (no more [SEND_DEMO_SMS] loops)
 *   ✓ Graceful call-end with Twilio API hangup
 *   ✓ Turn counter for natural pacing
 *   ✓ Call timeout — auto-cleanup after 15 minutes of inactivity
 */
const {
    decodeTwilioMulawBase64,
    pcm16ToWavBuffer,
    concatPcm,
    rmsEnergy
} = require('./audio');
const { detectIntent, detectEmotion, chooseThinking, THINKING_LEVELS, getObjectionContext, planNextAction } = require('../prompts');

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// Noise filter: ignore these common STT artifacts
const NOISE_PATTERNS = /^(uh+|um+|hmm+|ah+|oh+|huh|mhm|okay|ok|hm+|\.+|,+|\s+)$/i;
const FILLER_ONLY = /^(uh|um|hmm|ah|oh|huh|mhm|hm|I|and|but|so|like|well|the|a|an|it|is|was|the)\.?$/i;

/**
 * v3.1: DTMF protection strategy.
 * The original call-drop bug was caused by DTMF tones triggering barge-in.
 * We fix this with BARGE_IN_MIN_MS (150ms sustained speech required for barge-in).
 * DTMF tones are typically 40-100ms, so they can never trigger barge-in.
 * We do NOT filter DTMF from the audio stream — that was causing user speech
 * to be incorrectly classified as DTMF and dropped.
 */

function hybridConfig() {
    const groqKey = process.env.GROQ_API_KEY;
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EST9Ui6982FZPSi7gCHi';
    const chatModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const sttModel = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
    const ttsModel = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';

    const ready = Boolean(groqKey && elevenKey);
    const blockers = [];
    if (!groqKey) blockers.push('GROQ_API_KEY missing (STT + chat)');
    if (!elevenKey) blockers.push('ELEVENLABS_API_KEY missing (TTS)');

    return {
        ready,
        blockers,
        provider: 'hybrid-groq-elevenlabs',
        model: chatModel,
        sttModel,
        ttsModel,
        voice: voiceId,
        groqKey,
        elevenKey
    };
}

async function transcribeWav(wavBuffer, cfg) {
    const form = new FormData();
    form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'utterance.wav');
    form.append('model', cfg.sttModel);
    form.append('language', 'en');
    form.append('response_format', 'json');

    const res = await fetch(GROQ_STT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.groqKey}` },
        body: form
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Groq STT ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    return (data.text || '').trim();
}

async function chatCompletion(systemPrompt, history, userText, cfg, { turnCount = 0, firedActions = new Set(), perTurnContext = '', dynamicTemperature = 0.7 } = {}) {
    // Inject context about conversation stage and fired actions
    let stageNote = '';
    if (firedActions.size > 0) {
        const actionList = [...firedActions].join(', ');
        stageNote += `\n\nACTION STATUS: These actions have already been completed: ${actionList}. Do NOT repeat them.`;
    }
    if (turnCount > 6) {
        stageNote += '\n\nCALL PACING: This call has been going on for a while. Wrap up naturally — either close the deal or say goodbye.';
    }
    // Per-turn intelligence from Intent/Emotion/Thinking engines
    if (perTurnContext) {
        stageNote += `\n\n${perTurnContext}`;
    }

    const messages = [
        { role: 'system', content: systemPrompt + stageNote },
        ...history,
        { role: 'user', content: userText }
    ];

    const res = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${cfg.groqKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: cfg.model,
            messages,
            temperature: dynamicTemperature,
            max_tokens: 80
        })
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Groq chat ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || '').trim();
}

async function synthesizeMulaw(text, cfg) {
    // Strip emit codes from spoken audio (actions still see full text)
    const speakText = text
        .replace(/\[[A-Z0-9_]+\]/gi, ' ')
        .replace(/https?:\/\/\S+/gi, '') // Don't speak URLs
        .replace(/\s+/g, ' ')
        .trim();
    if (!speakText) return Buffer.alloc(0);

    const modelsToTry = [
        'eleven_flash_v2_5',
        cfg.ttsModel || 'eleven_turbo_v2_5',
        'eleven_multilingual_v2'
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastErr = '';
    for (const modelId of modelsToTry) {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.voice)}/stream?output_format=ulaw_8000&optimize_streaming_latency=4`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'xi-api-key': cfg.elevenKey,
                'Content-Type': 'application/json',
                Accept: 'application/octet-stream'
            },
            body: JSON.stringify({
                text: speakText.slice(0, 900),
                model_id: modelId,
                voice_settings: {
                    stability: 0.40,
                    similarity_boost: 0.80,
                    style: 0.20,
                    use_speaker_boost: true
                }
            })
        });
        if (res.ok) {
            const ab = await res.arrayBuffer();
            const buf = Buffer.from(ab);
            // JSON error sometimes returns 200 with tiny body — treat short non-audio as fail
            if (buf.length > 50 && buf[0] !== 0x7b /* { */) return buf;
            lastErr = `model ${modelId}: short/invalid body (${buf.length} bytes)`;
            continue;
        }
        const errText = await res.text().catch(() => '');
        lastErr = `ElevenLabs TTS ${res.status} model=${modelId}: ${errText.slice(0, 220)}`;
        // Permission errors won't fix by switching model
        if (res.status === 401 || res.status === 403) break;
    }

    // Deepgram TTS fallback (if DEEPGRAM_API_KEY is present)
    if (process.env.DEEPGRAM_API_KEY) {
        try {
            const dgUrl = 'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000';
            const dgRes = await fetch(dgUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: speakText.slice(0, 900) })
            });
            if (dgRes.ok) {
                const ab = await dgRes.arrayBuffer();
                return Buffer.from(ab);
            }
        } catch {
            /* ignore dg fail */
        }
    }

    throw new Error(
        lastErr ||
        'ElevenLabs TTS failed. Create a full API key with text_to_speech permission at elevenlabs.io'
    );
}

/**
 * True streaming TTS — sends audio chunks to callback as they arrive from ElevenLabs.
 * v4.0: Eliminates the blocking wait for full TTS response.
 * Falls back to non-streaming Deepgram if ElevenLabs fails.
 */
async function synthesizeMulawStreaming(text, cfg, { onChunk, signal } = {}) {
    const speakText = text
        .replace(/\[[A-Z0-9_]+\]/gi, ' ')
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!speakText) return 0;

    const modelsToTry = [
        'eleven_flash_v2_5',
        cfg.ttsModel || 'eleven_turbo_v2_5',
        'eleven_multilingual_v2'
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastErr = '';
    for (const modelId of modelsToTry) {
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(cfg.voice)}/stream?output_format=ulaw_8000&optimize_streaming_latency=4`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'xi-api-key': cfg.elevenKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/octet-stream'
                },
                body: JSON.stringify({
                    text: speakText.slice(0, 900),
                    model_id: modelId,
                    voice_settings: {
                        stability: 0.40,
                        similarity_boost: 0.80,
                        style: 0.20,
                        use_speaker_boost: true
                    }
                }),
                signal
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                lastErr = `ElevenLabs TTS ${res.status} model=${modelId}: ${errText.slice(0, 220)}`;
                if (res.status === 401 || res.status === 403) break;
                continue;
            }

            // Stream the response body chunk by chunk
            const reader = res.body.getReader();
            let totalBytes = 0;
            let validated = false;

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = Buffer.from(value);

                    // Validate first chunk is audio, not JSON error disguised as 200
                    if (!validated) {
                        if (chunk.length > 0 && chunk[0] === 0x7b /* { */) {
                            try { reader.cancel(); } catch {}
                            lastErr = `model ${modelId}: JSON error in stream body`;
                            break;
                        }
                        validated = true;
                    }

                    totalBytes += chunk.length;
                    if (onChunk) await onChunk(chunk);
                }
            } finally {
                try { reader.releaseLock(); } catch {}
            }

            if (totalBytes > 50) return totalBytes;
            if (!validated) continue;
            lastErr = `model ${modelId}: short/invalid body (${totalBytes} bytes)`;
            continue;
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            lastErr = `model ${modelId}: ${err.message}`;
            continue;
        }
    }

    // Deepgram TTS fallback (non-streaming)
    if (process.env.DEEPGRAM_API_KEY) {
        try {
            const dgUrl = 'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000';
            const dgRes = await fetch(dgUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: speakText.slice(0, 900) }),
                signal
            });
            if (dgRes.ok) {
                const ab = await dgRes.arrayBuffer();
                const buf = Buffer.from(ab);
                if (buf.length > 50 && onChunk) await onChunk(buf);
                return buf.length;
            }
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            /* ignore dg fail */
        }
    }

    throw new Error(
        lastErr ||
        'ElevenLabs TTS failed. Create a full API key with text_to_speech permission at elevenlabs.io'
    );
}

/**
 * Attach hybrid turn-based voice handler to Twilio media WebSocket.
 * v4.0 — True streaming TTS, AbortController barge-in, varied openings.
 */
function attachHybridMediaHandler(connection, { log, systemPrompt, processTranscript, lead }) {
    const cfg = hybridConfig();
    const socket = connection.socket || connection;

    let streamSid = null;
    let pcmChunks = [];
    let history = [];
    let speaking = false;
    let processing = false;
    let closed = false;
    let silenceMs = 0;
    let speechMs = 0;
    let inSpeech = false;
    let turnCount = 0;
    let callEnding = false; // Set after goodbye — triggers auto-hangup
    let bargeInDetected = false; // Set when user speaks while AI is talking
    // BUGFIX v2: once a barge-in starts, keep collecting the interrupting speech
    let collectingAfterBargeIn = false;

    // v3.0: Cancellation token for barge-in race condition fix
    let currentTurnId = 0;
    let currentTtsAbortController = null; // v4.0: AbortController for in-flight TTS


    // v3.1: Adaptive noise floor — skip first 25 frames (connection noise),
    // then sample 25 frames of real ambient audio
    let noiseFloorSamples = [];
    let noiseFloorCalibrated = false;
    let adaptiveNoiseFloor = 0;
    let noiseFloorSkipFrames = 25; // skip connection/setup noise
    const NOISE_CALIBRATION_FRAMES = 25; // ~500ms of frames for calibration
    const MAX_ADAPTIVE_THRESHOLD = 0.040; // never set threshold above this — would miss real speech

    // Track which actions have been fired
    const firedActions = new Set();

    // v3.2: Track whether the next utterance came from a barge-in
    let nextUtteranceIsBargeIn = false;

    // Transcript storage — full conversation record
    const transcript = [];

    // Call analytics
    const callStartTime = Date.now();
    const turnLatencies = []; // ms per turn (user speech end → AI audio start)
    let totalSttMs = 0;
    let totalTtsMs = 0;

    // v3.0: Call timeout — auto-cleanup after 15 min of no activity
    let lastActivityAt = Date.now();
    const CALL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    const callTimeoutInterval = setInterval(() => {
        if (Date.now() - lastActivityAt > CALL_TIMEOUT_MS && !closed) {
            log.warn?.(`[hybrid] ⏰ Call timeout after ${Math.round(CALL_TIMEOUT_MS / 60000)}m inactivity`);
            closed = true;
            saveCallSummary();
            clearInterval(callTimeoutInterval);
        }
    }, 60_000); // check every minute

    // Tunables (8kHz: 20ms ≈ one Twilio frame often)
    // v3.1: Lowered from 0.025 to 0.020 — 0.025 was too high and filtering real speech
    const ENERGY_THRESHOLD = Number(process.env.VAD_ENERGY || 0.020);
    const SILENCE_END_MS = Number(process.env.VAD_SILENCE_MS || 700);
    const MIN_SPEECH_MS = Number(process.env.VAD_MIN_SPEECH_MS || 300);
    const MAX_UTTERANCE_MS = Number(process.env.VAD_MAX_UTTERANCE_MS || 12000);

    // v3.0: Minimum sustained speech duration before barge-in triggers
    const BARGE_IN_MIN_MS = Number(process.env.BARGE_IN_MIN_MS || 150);
    // v3.0: Barge-in energy multiplier (higher = harder to trigger)
    const BARGE_IN_ENERGY_MULT = Number(process.env.BARGE_IN_ENERGY_MULT || 2.5);

    /**
     * v3.1: Adaptive noise floor calibration.
     * Skip the first ~500ms (connection tones/setup noise), then sample
     * ~500ms of real ambient audio to set the noise floor.
     * Threshold is capped at MAX_ADAPTIVE_THRESHOLD to never miss real speech.
     */
    function calibrateNoiseFloor(energy) {
        if (noiseFloorCalibrated) return;
        // Skip initial frames — they contain connection noise, not real ambient
        if (noiseFloorSkipFrames > 0) {
            noiseFloorSkipFrames--;
            return;
        }
        noiseFloorSamples.push(energy);
        if (noiseFloorSamples.length >= NOISE_CALIBRATION_FRAMES) {
            const sorted = [...noiseFloorSamples].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            // Set adaptive threshold at 2.5x the noise floor, capped at MAX_ADAPTIVE_THRESHOLD
            const raw = median * 2.5;
            adaptiveNoiseFloor = Math.min(Math.max(ENERGY_THRESHOLD, raw), MAX_ADAPTIVE_THRESHOLD);
            noiseFloorCalibrated = true;
            log.info?.(`[hybrid] 📊 Noise floor calibrated: median=${median.toFixed(4)} raw=${raw.toFixed(4)} threshold=${adaptiveNoiseFloor.toFixed(4)}`);
        }
    }

    /**
     * Get the effective energy threshold (adaptive or default).
     */
    function getEffectiveThreshold() {
        return noiseFloorCalibrated ? adaptiveNoiseFloor : ENERGY_THRESHOLD;
    }

    /**
     * Send Twilio a "clear" message to stop current audio playback.
     * Used for barge-in: when user starts talking, we stop the AI mid-sentence.
     */
    function clearTwilioAudio() {
        if (!streamSid || closed || socket.readyState !== 1) return;
        try {
            socket.send(JSON.stringify({ event: 'clear', streamSid }));
            log.info?.('[hybrid] ⚡ barge-in: cleared Twilio audio buffer');
        } catch { /* ignore */ }
    }

    /**
     * Auto-hangup the call via Twilio REST API after goodbye.
     */
    async function autoHangup(reason = 'call_complete') {
        if (closed) return;
        const callSid = lead?.callSid;
        if (!callSid) return;

        // Wait 2.5 seconds for final audio to play, then hang up
        setTimeout(async () => {
            try {
                const { getTelephonyClient } = require('./telephony');
                const client = getTelephonyClient();
                if (client) {
                    await client.calls(callSid).update({ status: 'completed' });
                    log.info?.(`[hybrid] 📞 auto-hangup: ${reason} callSid=${callSid}`);
                }
            } catch (err) {
                log.error?.({ err }, 'Auto-hangup failed');
            }
            closed = true;
            clearInterval(callTimeoutInterval);
        }, 2500);
    }

    /**
     * v4.0: Send a single audio chunk to Twilio, split into 640-byte (80ms) packets.
     * Called repeatedly by streaming TTS — no silence prefix here (handled by speakAssistant).
     */
    async function sendMulawChunk(chunk) {
        if (!streamSid || closed || bargeInDetected || socket.readyState !== 1) return;

        const chunkSize = 640; // 80ms of 8kHz mu-law audio
        for (let i = 0; i < chunk.length; i += chunkSize) {
            if (bargeInDetected || closed || socket.readyState !== 1) {
                log.info?.('[hybrid] ⚡ stopped audio — barge-in or close');
                break;
            }
            const slice = chunk.subarray(i, i + chunkSize);
            const payload = slice.toString('base64');
            socket.send(
                JSON.stringify({
                    event: 'media',
                    streamSid,
                    media: { payload }
                })
            );
            // Pace ~60ms delay for 80ms audio buffer so Twilio's buffer stays full & smooth
            await new Promise((r) => setTimeout(r, 60));
        }
    }

    async function speakAssistant(fullText, { isOpening = false } = {}) {
        if (!fullText || closed) return;

        // v4.0: Tightened regex — only triggers on explicit demo/portfolio/preview mentions,
        // not generic "info" or "link". Prevents false "contact details" SMS triggers.
        if (!firedActions.has('SEND_DEMO_SMS') && !/\[SEND_DEMO_SMS\]/i.test(fullText)) {
            if (/(text|sms|send).*(demo|portfolio|preview)|(texted|texting|sending).*(demo|portfolio|preview)/i.test(fullText)) {
                log.info?.('[hybrid] 💡 Auto-detected implicit demo SMS intent — appending [SEND_DEMO_SMS]');
                fullText += ' [SEND_DEMO_SMS]';
            }
        }

        speaking = true;
        bargeInDetected = false;
        lastActivityAt = Date.now();
        log.info?.(`[hybrid] 🗣 TTS start: "${fullText.slice(0, 80)}…" isOpening=${isOpening}`);
        try {
            if (processTranscript) {
                await processTranscript(fullText, lead, { reason: isOpening ? 'opening' : 'hybrid_turn' });
            }

            // v4.0: True streaming TTS with AbortController for barge-in cancellation
            currentTtsAbortController = new AbortController();
            const ttsStart = Date.now();
            let isFirstChunk = true;
            let totalBytes = 0;

            try {
                totalBytes = await synthesizeMulawStreaming(fullText, cfg, {
                    signal: currentTtsAbortController.signal,
                    onChunk: async (chunk) => {
                        if (bargeInDetected || closed) return;

                        if (isFirstChunk) {
                            // Add silence prefix only before first chunk (80ms anti-clip)
                            const silencePrefix = Buffer.alloc(640, 0xFF);
                            await sendMulawChunk(silencePrefix);
                            isFirstChunk = false;
                            log.info?.(`[hybrid] 🗣 TTS first chunk in ${Date.now() - ttsStart}ms`);
                        }

                        await sendMulawChunk(chunk);
                    }
                });

                if (totalBytes > 0) {
                    try {
                        socket.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: 'ai_end' } }));
                    } catch { /* ignore */ }
                    log.info?.(`[hybrid] 🗣 TTS streamed: ${totalBytes} bytes in ${Date.now() - ttsStart}ms`);
                } else {
                    log.warn?.('[hybrid] ⚠ TTS returned empty audio!');
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    log.info?.('[hybrid] 🗣 TTS aborted (barge-in)');
                } else {
                    throw err;
                }
            } finally {
                currentTtsAbortController = null;
            }

            // Detect action codes that were in the response
            const actionCodes = (fullText.match(/\[[A-Z0-9_]+\]/g) || []).map(c => c.replace(/[\[\]]/g, ''));
            for (const code of actionCodes) firedActions.add(code);

            // Keep spoken text in history without bracket codes
            const clean = fullText.replace(/\[[A-Z0-9_]+\]/gi, '').trim();
            if (clean) history.push({ role: 'assistant', content: clean });

            // Inject action-completion system notes — prevents repeat loops
            if (actionCodes.includes('SEND_DEMO_SMS')) {
                history.push({
                    role: 'system',
                    content: 'SYSTEM: Demo SMS has been sent successfully. Do NOT say [SEND_DEMO_SMS] again. If the user asks more questions, answer them naturally. Otherwise say goodbye and end the call.'
                });
            }
            if (actionCodes.includes('DO_NOT_CALL')) {
                history.push({
                    role: 'system',
                    content: 'SYSTEM: User has been marked do-not-call. Say a brief goodbye and stop talking.'
                });
                callEnding = true;
                autoHangup('do_not_call');
            }

            // v3.0: Less aggressive auto-hangup
            const lowerText = clean.toLowerCase();

            const hardGoodbye =
                /\b(goodbye|bye[\s-]?bye|bye then)\b/i.test(lowerText);

            const softGoodbye =
                turnCount >= 5 &&
                /\b(talk soon|take care|have a (great|good|nice) (day|one|evening|night)|have a good one)\b/i.test(lowerText) &&
                !/\b(question|demo|link|price|cost|how much|tell me|what|show|send|can you|do you|is there)\b/i.test(lowerText);

            if (!callEnding && (hardGoodbye || softGoodbye)) {
                callEnding = true;
                autoHangup('goodbye_detected');
            }

            if (history.length > 20) history = history.slice(-20);
            turnCount++;
        } finally {
            speaking = false;
        }
    }

    /**
     * Check if transcript is just noise/filler and should be ignored.
     */
    function isNoise(text) {
        if (!text) return true;
        const trimmed = text.trim();
        // Clean leading/trailing punctuation and ellipses (e.g. "uh..." -> "uh")
        const cleaned = trimmed.replace(/^[.,!?;:\s]+|[.,!?;:\s]+$/g, '').trim();
        if (cleaned.length < 2) return true;
        if (NOISE_PATTERNS.test(cleaned)) return true;
        // Single word under 4 chars that's just filler
        if (cleaned.split(/\s+/).length === 1 && FILLER_ONLY.test(cleaned)) return true;
        return false;
    }

    async function processUtterance(pcm) {
        if (processing || closed || callEnding) return;
        processing = true;
        // v3.0: Track turn ID for cancellation
        const myTurnId = ++currentTurnId;
        try {
            const durationSec = pcm.length / 8000;
            if (durationSec < 0.25) return;

            lastActivityAt = Date.now();
            const turnStart = Date.now();
            const wav = pcm16ToWavBuffer(pcm, 8000);
            log.info?.(`[hybrid] STT ${durationSec.toFixed(2)}s audio…`);

            const sttStart = Date.now();
            const userText = await transcribeWav(wav, cfg);
            const sttMs = Date.now() - sttStart;
            totalSttMs += sttMs;

            // v3.0: Check if this turn was cancelled by barge-in
            if (myTurnId !== currentTurnId) {
                log.info?.(`[hybrid] 🚫 Turn ${myTurnId} cancelled by newer turn ${currentTurnId}`);
                return;
            }

            // Noise filter: skip filler words and artifacts
            if (isNoise(userText)) {
                log.info?.(`[hybrid] 🔇 noise filtered: "${userText}"`);
                return;
            }

            log.info?.(`[hybrid] user: ${userText} (STT: ${sttMs}ms)`);

            // Record user turn in transcript
            transcript.push({
                role: 'user',
                text: userText,
                at: new Date().toISOString(),
                audioSec: Number(durationSec.toFixed(2)),
                sttMs,
                bargeIn: nextUtteranceIsBargeIn
            });
            nextUtteranceIsBargeIn = false;

            // v5.0: Per-turn intelligence from Prompt Engine
            const intent = detectIntent(userText);
            const emotion = detectEmotion(userText);
            const thinkingLevel = chooseThinking(intent);
            const thinkingCfg = THINKING_LEVELS[thinkingLevel] || THINKING_LEVELS.NORMAL;
            const plan = planNextAction({ stage: lead?.stage, intent, emotion: emotion.emotion });

            let perTurnContext = `--- PER-TURN INTELLIGENCE ---\n`;
            perTurnContext += `Intent: ${intent} | Emotion: ${emotion.emotion} (${emotion.confidence}) | Thinking: ${thinkingLevel}\n`;
            perTurnContext += `Guidance: ${emotion.guidance}\n`;
            perTurnContext += `Planner Action: ${plan.action} | Goal: ${plan.goal} | Reply Style: ${plan.replyStyle}\n`;
            perTurnContext += `Max Words: ${thinkingCfg.maxWords}`;

            if (intent === 'OBJECTION') {
                perTurnContext += `\n${getObjectionContext(userText)}`;
            }

            const llmStart = Date.now();
            const reply = await chatCompletion(systemPrompt, history, userText, cfg, {
                turnCount,
                firedActions,
                perTurnContext,
                dynamicTemperature: thinkingCfg.temperature || 0.7
            });
            const llmMs = Date.now() - llmStart;

            // v3.0: Check again after LLM call
            if (myTurnId !== currentTurnId) {
                log.info?.(`[hybrid] 🚫 Turn ${myTurnId} cancelled after LLM by newer turn ${currentTurnId}`);
                return;
            }

            log.info?.(`[hybrid] assistant: ${reply.slice(0, 120)}… (LLM: ${llmMs}ms)`);
            // Persist user text in history for future turns.
            // chatCompletion() builds a local messages array with [...history, {user: userText}]
            // so this push does NOT cause duplication — it's needed for subsequent turns.
            history.push({ role: 'user', content: userText });

            const ttsStart = Date.now();
            await speakAssistant(reply);
            const ttsMs = Date.now() - ttsStart;
            totalTtsMs += ttsMs;

            // Record assistant turn in transcript
            const clean = reply.replace(/\[[A-Z0-9_]+\]/gi, '').trim();
            transcript.push({
                role: 'assistant',
                text: clean,
                at: new Date().toISOString(),
                llmMs,
                ttsMs
            });

            // Track turn latency (total time from user speech end to AI audio start)
            turnLatencies.push(Date.now() - turnStart);
            log.info?.(`[hybrid] ⏱ turn ${turnCount}: STT=${sttMs}ms LLM=${llmMs}ms TTS=${ttsMs}ms total=${Date.now() - turnStart}ms`);
        } catch (err) {
            log.error?.({ err }, 'Hybrid turn failed');
            // Only speak error recovery if this turn is still current
            if (myTurnId === currentTurnId) {
                try {
                    await speakAssistant(
                        "I hear you — give me one second. I'm having a brief connection hiccup."
                    );
                } catch {
                    /* ignore */
                }
            }
        } finally {
            processing = false;
        }
    }

    function resetVad() {
        pcmChunks = [];
        silenceMs = 0;
        speechMs = 0;
        inSpeech = false;
        collectingAfterBargeIn = false;
    }

    // v3.0: Track sustained barge-in speech frames
    let bargeInSpeechMs = 0;

    function onPcmFrame(pcm) {
        if (closed || callEnding) return;

        const energy = rmsEnergy(pcm);
        const frameMs = (pcm.length / 8000) * 1000;

        // v3.1: Calibrate noise floor during first ~500ms
        calibrateNoiseFloor(energy);

        const threshold = getEffectiveThreshold();

        // BARGE-IN: if user speaks while AI is talking, interrupt the AI
        // v3.0: Require sustained speech (BARGE_IN_MIN_MS) before triggering
        // Protect opening greeting and initial calibration frames from line setup noise
        if (speaking && noiseFloorCalibrated && energy >= threshold * BARGE_IN_ENERGY_MULT) {
            bargeInSpeechMs += frameMs;

            // Only trigger barge-in after sustained speech, not a short burst
            if (bargeInSpeechMs >= BARGE_IN_MIN_MS) {
                bargeInDetected = true;
                currentTtsAbortController?.abort(); // v4.0: Cancel in-flight TTS fetch
                bargeInSpeechMs = 0;
                try {
                    const store = require('./store');
                    store.addEvent({
                        type: 'USER_INTERRUPT',
                        callSid: lead?.callSid,
                        phone: lead?.targetPhoneNumber || lead?.phone,
                        clientName: lead?.clientName,
                        bargeIn: true
                    });
                } catch {
                    /* ignore analytics write on interrupt path */
                }
                clearTwilioAudio();
                speaking = false; // Force speaking flag off so VAD starts collecting
                resetVad();
                // Start collecting this frame as new speech
                collectingAfterBargeIn = true;
                // v3.2: Mark next utterance as barge-in for analytics
                nextUtteranceIsBargeIn = true;
                // v3.0: Increment turn ID to cancel any in-flight processing
                currentTurnId++;
                inSpeech = true;
                speechMs = frameMs;
                pcmChunks.push(pcm);
                log.info?.('[hybrid] ⚡ barge-in triggered after sustained speech');
                return;
            }
            // Still accumulating barge-in speech — collect but don't trigger yet
            return;
        } else if (speaking) {
            // Not enough energy for barge-in — reset counter
            bargeInSpeechMs = 0;
            return;
        }

        if (processing && !collectingAfterBargeIn) return;

        if (energy >= threshold) {
            inSpeech = true;
            speechMs += frameMs;
            silenceMs = 0;
            pcmChunks.push(pcm);
        } else if (inSpeech) {
            silenceMs += frameMs;
            pcmChunks.push(pcm);
            if (silenceMs >= SILENCE_END_MS) {
                if (speechMs >= MIN_SPEECH_MS) {
                    const utterance = concatPcm(pcmChunks);
                    resetVad();
                    processUtterance(utterance);
                } else {
                    // Short blip/noise — reset
                    resetVad();
                }
            }
        }

        // safety: force cut long monologues
        if (inSpeech && speechMs >= MAX_UTTERANCE_MS) {
            const utterance = concatPcm(pcmChunks);
            resetVad();
            processUtterance(utterance);
        }
    }

    socket.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.event === 'start') {
                streamSid = data.start.streamSid;
                log.info?.(
                    `[hybrid] media start stream=${streamSid} model=${cfg.model} voice=${cfg.voice}`
                );
                // Outbound: AI speaks first — required AI disclosure (agent/company from env)
                if (lead?.callType !== 'inbound' && lead?.type !== 'inbound-receptionist') {
                    const agent = process.env.AGENT_NAME || 'Sarah';
                    const company = process.env.COMPANY_NAME || 'ZeroRefer';
                    // v4.0: Varied openings — random selection per call for natural feel
                    const openings = [
                        `Hi! I'm ${agent}, an AI assistant with ${company}. Quick question — are you the owner? We help businesses never miss another call.`,
                        `Hey! This is ${agent}, an AI from ${company}. Am I speaking with the owner? I've got something that could help your business.`,
                        `Hi there! ${agent} here, an AI assistant from ${company}. Is this the business owner? I noticed something about your online presence.`,
                        `Hello! I'm ${agent}, an AI with ${company}. Am I reaching the owner? We specialize in making sure you never lose a lead to voicemail.`,
                        `Hey! ${agent} from ${company} — I'm an AI assistant. Are you the owner? I've got a quick idea that could help your business grow.`
                    ];
                    const opening = openings[Math.floor(Math.random() * openings.length)];
                    speakAssistant(opening, { isOpening: true }).catch((e) =>
                        log.error?.({ e }, 'Opening TTS error')
                    );
                }
            } else if (data.event === 'media' && data.media?.payload) {
                const pcm = decodeTwilioMulawBase64(data.media.payload);
                onPcmFrame(pcm);
            } else if (data.event === 'dtmf') {
                // v3.1: Handle explicit Twilio DTMF events (if stream sends them)
                const digit = data.dtmf?.digit || data.dtmf?.Digit;
                log.info?.(`[hybrid] 🔢 Twilio DTMF event: digit=${digit}`);
                try {
                    const store = require('./store');
                    store.addEvent({
                        type: 'DTMF_RECEIVED',
                        callSid: lead?.callSid,
                        digit,
                        phone: lead?.targetPhoneNumber
                    });
                } catch { /* ignore */ }
            } else if (data.event === 'stop') {
                closed = true;
                clearInterval(callTimeoutInterval);
                saveCallSummary();
                log.info?.('[hybrid] media stop');
            }
        } catch (err) {
            log.error?.({ err }, 'Hybrid media message error');
        }
    });

    socket.on('close', () => {
        closed = true;
        clearInterval(callTimeoutInterval);
        saveCallSummary();
    });
    socket.on('error', () => {
        closed = true;
        clearInterval(callTimeoutInterval);
    });

    // Save transcript + analytics to store on call end
    let summarySaved = false;
    function saveCallSummary() {
        if (summarySaved) return;
        summarySaved = true;
        const store = require('./store');
        const callSid = lead?.callSid;
        const durationSec = ((Date.now() - callStartTime) / 1000).toFixed(1);
        const avgLatency = turnLatencies.length
            ? (turnLatencies.reduce((a, b) => a + b, 0) / turnLatencies.length).toFixed(0)
            : 'n/a';

        const analytics = {
            durationSec: Number(durationSec),
            totalTurns: turnCount,
            avgResponseLatencyMs: avgLatency === 'n/a' ? null : Number(avgLatency),
            totalSttMs,
            totalTtsMs,
            bargeIns: transcript.filter(t => t.bargeIn).length,
            actionsTriggered: [...firedActions]
        };

        log.info?.({
            callSid,
            ...analytics,
            transcriptLines: transcript.length
        }, `[hybrid] 📊 Call Summary`);

        if (callSid) {
            store.setCall(callSid, {
                ...lead,
                transcript,
                analytics,
                status: 'completed',
                stage: lead?.stage || 'call_completed'
            });
        }

        store.addEvent({
            type: 'CALL_COMPLETED',
            callSid,
            phone: lead?.targetPhoneNumber,
            clientName: lead?.clientName,
            ...analytics
        });
    }
}

module.exports = {
    hybridConfig,
    attachHybridMediaHandler,
    transcribeWav,
    chatCompletion,
    synthesizeMulaw,
    synthesizeMulawStreaming
};
