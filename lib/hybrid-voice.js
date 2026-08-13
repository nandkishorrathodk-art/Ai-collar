/**
 * Hybrid phone voice path v5.0 — PRODUCTION HARDENED:
 *   Twilio μ-law  →  Groq Whisper (STT)  →  Groq Chat (LLM)  →  Multi-Engine TTS (ulaw_8000)  →  Twilio
 *
 * v5.0 upgrades over v4.0:
 *   ✓ Multi-engine TTS with auto-failover (ElevenLabs → Deepgram → Google TTS)
 *   ✓ Sentence-level streaming (50% faster first-word latency)
 *   ✓ Self-learning call outcome tracking
 *   ✓ Enhanced voice quality settings
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
const { detectIntent, detectEmotion, chooseThinking, THINKING_LEVELS, getObjectionContext, planNextAction, sanitizeForHumanSpeech, recordCallOutcome, clearCallObjections } = require('../prompts');
const { synthesizeWithFailover, getTTSHealthReport } = require('./tts-engine');

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// Noise filter: ignore these common STT artifacts (allow affirmative confirmation words like "ok" / "okay")
const NOISE_PATTERNS = /^(uh+|um+|hmm+|ah+|oh+|huh|mhm|hm+|\.+|,+|\s+)$/i;
const FILLER_ONLY = /^(uh|um|hmm|ah|oh|huh|mhm|hm|I|and|but|so|like|well|the|a|an|it|is|was|the)\.?$/i;

function maskPii(text = '') {
    if (typeof text !== 'string') return text;
    return text
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (email) => {
            const parts = email.split('@');
            if (parts[0].length <= 2) return `${parts[0][0]}*@${parts[1]}`;
            return `${parts[0][0]}***${parts[0].slice(-1)}@${parts[1]}`;
        })
        .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, (phone) => {
            const digits = phone.replace(/\D/g, '');
            if (digits.length < 7) return phone;
            return `+${digits.slice(0, digits.length - 4).replace(/\d/g, '*')}***${digits.slice(-4)}`;
        });
}

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
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const chatModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    const sttModel = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
    const ttsModel = process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5';

    // v6.0: Accept either ElevenLabs or Deepgram as valid TTS engine
    const hasTts = Boolean(elevenKey || process.env.DEEPGRAM_API_KEY);
    const ready = Boolean(groqKey && hasTts);
    const blockers = [];
    if (!groqKey) blockers.push('GROQ_API_KEY missing (STT + chat)');
    if (!hasTts) blockers.push('No TTS engine configured (set ELEVENLABS_API_KEY or DEEPGRAM_API_KEY)');

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

    const recentHistory = (history || []).slice(-6);

    const messages = [
        { role: 'system', content: systemPrompt + stageNote },
        ...recentHistory,
        { role: 'user', content: userText }
    ];

    const modelsToTry = [cfg.model, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'].filter(
        (m, i, arr) => m && arr.indexOf(m) === i
    );

    let lastErr = '';
    for (const modelName of modelsToTry) {
        try {
            const res = await fetch(GROQ_CHAT_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${cfg.groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    messages,
                    temperature: dynamicTemperature,
                    max_tokens: 150
                })
            });
            if (res.ok) {
                const data = await res.json();
                return (data.choices?.[0]?.message?.content || '').trim();
            }
            const errText = await res.text().catch(() => '');
            lastErr = `Groq chat ${res.status} model=${modelName}: ${errText.slice(0, 300)}`;
            continue;
        } catch (err) {
            lastErr = err.message;
            continue;
        }
    }

    throw new Error(lastErr || 'Groq chat completion failed');
}

/**
 * v5.0: Sentence-level streaming chat completion.
 * Streams LLM response and calls onSentence callback for each complete sentence.
 * This allows TTS to start speaking the first sentence while the LLM generates the rest.
 */
async function chatCompletionStreaming(systemPrompt, history, userText, cfg, { turnCount = 0, firedActions = new Set(), perTurnContext = '', dynamicTemperature = 0.7, onSentence, signal } = {}) {
    let stageNote = '';
    if (firedActions.size > 0) {
        stageNote += `\n\nACTION STATUS: These actions have already been completed: ${[...firedActions].join(', ')}. Do NOT repeat them.`;
    }
    if (turnCount > 6) {
        stageNote += '\n\nCALL PACING: Wrap up naturally — either close the deal or say goodbye.';
    }
    if (perTurnContext) stageNote += `\n\n${perTurnContext}`;

    const messages = [
        { role: 'system', content: systemPrompt + stageNote },
        ...(history || []).slice(-6),
        { role: 'user', content: userText }
    ];

    const modelsToTry = [cfg.model, 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'].filter(
        (m, i, arr) => m && arr.indexOf(m) === i
    );

    let lastErr = '';
    for (const modelName of modelsToTry) {
        try {
            const res = await fetch(GROQ_CHAT_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${cfg.groqKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    messages,
                    temperature: dynamicTemperature,
                    max_tokens: 150,
                    stream: true
                }),
                signal
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                lastErr = `Groq stream ${res.status} model=${modelName}: ${errText.slice(0, 300)}`;
                continue;
            }

            // Parse SSE stream and split into sentences
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';
            let sseBuffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    sseBuffer += decoder.decode(value, { stream: true });
                    const lines = sseBuffer.split('\n');
                    sseBuffer = lines.pop() || ''; // Keep incomplete line

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') break;

                        try {
                            const chunk = JSON.parse(data);
                            const token = chunk.choices?.[0]?.delta?.content || '';
                            if (!token) continue;

                            buffer += token;
                            fullResponse += token;

                            // Protect against partial tags or newlines splitting the tag
                            const openThinking = (buffer.match(/<thinking[^>]*>/gi) || []).length;
                            const closeThinking = (buffer.match(/<\/thinking>/gi) || []).length;
                            if (openThinking > closeThinking) continue;
                            
                            // Wait if there is any unclosed `<` or `[` that could be a tag
                            // (We only wait if there is a `<` without a matching `>` AFTER it)
                            const lastOpenAngle = buffer.lastIndexOf('<');
                            const lastCloseAngle = buffer.lastIndexOf('>');
                            if (lastOpenAngle > lastCloseAngle) continue;
                            
                            const lastOpenBracket = buffer.lastIndexOf('[');
                            const lastCloseBracket = buffer.lastIndexOf(']');
                            if (lastOpenBracket > lastCloseBracket) continue;

                            // Strip complete tags and markdown from buffer so they aren't spoken
                            buffer = buffer
                                .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
                                .replace(/\[[A-Z0-9_:]+\]/gi, '')
                                .replace(/[*#~]/g, ''); // Strip markdown that TTS might speak

                            // Check for sentence boundaries
                            const sentenceEnd = buffer.match(/[.!?]\s|[.!?]$|—\s|\n/);
                            if (sentenceEnd && buffer.trim().length > 15) {
                                const idx = sentenceEnd.index + sentenceEnd[0].length;
                                const sentence = buffer.slice(0, idx).trim();
                                buffer = buffer.slice(idx);
                                if (sentence && onSentence) {
                                    await onSentence(sentence);
                                }
                            }
                        } catch { /* skip malformed JSON */ }
                    }
                }
            } finally {
                try { reader.releaseLock(); } catch {}
            }

            // Flush remaining buffer as final sentence
            if (buffer.trim() && onSentence) {
                await onSentence(buffer.trim());
            }

            return fullResponse.trim();
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            lastErr = err.message;
        }
    }

    // Fallback to non-streaming if streaming fails
    return chatCompletion(systemPrompt, history, userText, cfg, { turnCount, firedActions, perTurnContext, dynamicTemperature });
}

/**
 * v5.0: Unified TTS synthesis using the multi-engine tts-engine.
 * Falls back through ElevenLabs → Deepgram → Google Cloud TTS automatically.
 */
async function synthesizeMulaw(text, cfg) {
    return synthesizeWithFailover(text, cfg, { streaming: false });
}

async function synthesizeMulawStreaming(text, cfg, { onChunk, signal } = {}) {
    return synthesizeWithFailover(text, cfg, { streaming: true, onChunk, signal });
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
    const SILENCE_END_MS = Number(process.env.VAD_SILENCE_MS || 550);
    const MIN_SPEECH_MS = Number(process.env.VAD_MIN_SPEECH_MS || 300);
    const MAX_UTTERANCE_MS = Number(process.env.VAD_MAX_UTTERANCE_MS || 12000);

    // v5.2: Minimum sustained speech duration before barge-in triggers (300ms prevents line clicks from killing audio)
    const BARGE_IN_MIN_MS = Number(process.env.BARGE_IN_MIN_MS || 300);
    // v5.2: Barge-in energy multiplier (3.5x threshold prevents false triggers from ambient line noise)
    const BARGE_IN_ENERGY_MULT = Number(process.env.BARGE_IN_ENERGY_MULT || 3.5);

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
            try {
                socket.send(
                    JSON.stringify({
                        event: 'media',
                        streamSid,
                        media: { payload }
                    })
                );
            } catch {
                break;
            }
            // Pace ~20ms delay for 80ms audio buffer so Twilio's buffer stays full & smooth
            await new Promise((r) => setTimeout(r, 20));
        }
    }

    async function speakAssistant(fullText, { isOpening = false, streamingSentence = false } = {}) {
        if (!fullText || closed) return;

        // v4.0: Tightened regex — only triggers on explicit demo/portfolio/preview mentions,
        // not generic "info" or "link". Prevents false "contact details" SMS triggers.
        // Skip auto-detection in streamingSentence mode (action codes handled by processUtterance)
        if (!streamingSentence && !firedActions.has('SEND_DEMO_SMS') && !/\[SEND_DEMO_SMS\]/i.test(fullText)) {
            if (/(text|sms|send).*(demo|portfolio|preview)|(texted|texting|sending).*(demo|portfolio|preview)/i.test(fullText)) {
                log.info?.('[hybrid] 💡 Auto-detected implicit demo SMS intent — appending [SEND_DEMO_SMS]');
                fullText += ' [SEND_DEMO_SMS]';
            }
        }

        // v6.0: In streamingSentence mode, don't toggle speaking flag per-sentence
        // The calling code (processUtterance) manages speaking=true for the full streaming duration
        if (!streamingSentence) {
            speaking = true;
            bargeInDetected = false;
        }
        lastActivityAt = Date.now();
        log.info?.(`[hybrid] 🗣 TTS start: "${fullText.slice(0, 80)}…" isOpening=${isOpening} streaming=${streamingSentence}`);
        try {
            // v6.0: Skip transcript processing for individual streaming sentences (already handled per-turn)
            if (!streamingSentence && processTranscript) {
                await processTranscript(fullText, lead, { reason: isOpening ? 'opening' : 'hybrid_turn' });
            }

            // v4.0: True streaming TTS with AbortController for barge-in cancellation
            currentTtsAbortController = new AbortController();
            const ttsStart = Date.now();
            let isFirstChunk = true;
            let totalBytes = 0;

            try {
                totalBytes = await synthesizeWithFailover(fullText, cfg, {
                    streaming: true,
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
                    // v6.0: Only send ai_end mark for non-streaming sentences (full response)
                    // or for the last sentence in a streaming pipeline (handled by processUtterance)
                    if (!streamingSentence) {
                        try {
                            socket.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: 'ai_end' } }));
                        } catch { /* ignore */ }
                    }
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

            // v6.0: Skip all side-effects in streamingSentence mode
            // Action codes, goodbye detection, history, and turnCount are handled by processUtterance
            if (streamingSentence) return;

            // Detect action codes that were in the response
            const actionCodes = (fullText.match(/\[[A-Z0-9_]+\]/g) || []).map(c => c.replace(/[\[\]]/g, ''));
            for (const code of actionCodes) firedActions.add(code);

            // Keep spoken text in history without bracket codes (only for initial opening greeting; processUtterance handles turn history)
            const clean = fullText.replace(/\[[A-Z0-9_]+\]/gi, '').trim();
            if (clean && isOpening) history.push({ role: 'assistant', content: clean });

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
            // v6.0: Don't clear speaking flag in streamingSentence mode
            if (!streamingSentence) {
                speaking = false;
            }
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

            log.info?.(`[hybrid] user: ${maskPii(userText)} (STT: ${sttMs}ms)`);

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

            if (intent === 'OBJECTION' && typeof getObjectionContext === 'function') {
                perTurnContext += `\n${getObjectionContext(userText)}`;
            }

            // v6.0: SENTENCE-LEVEL STREAMING PIPELINE
            // Instead of waiting for full LLM response then full TTS, we fire TTS
            // per-sentence as the LLM streams, cutting first-audio latency by ~4-5 seconds.
            const llmStart = Date.now();
            let firstSentenceAt = 0;
            let sentenceCount = 0;
            let ttsMs = 0;
            const ttsStart = Date.now();

            // v6.0: Set speaking=true for the ENTIRE streaming duration
            // This ensures barge-in detection works correctly between sentences
            speaking = true;
            bargeInDetected = false;

            // AbortController for cancelling if barge-in happens during streaming
            const streamAbort = new AbortController();

            try {
                const fullReply = await chatCompletionStreaming(systemPrompt, history, userText, cfg, {
                    turnCount,
                    firedActions,
                    perTurnContext,
                    dynamicTemperature: thinkingCfg.temperature || 0.7,
                    signal: streamAbort.signal,
                    onSentence: async (sentence) => {
                        // Check if this turn was cancelled by barge-in
                        if (myTurnId !== currentTurnId || bargeInDetected || closed) {
                            streamAbort.abort();
                            return;
                        }

                        sentenceCount++;
                        if (!firstSentenceAt) {
                            firstSentenceAt = Date.now();
                            log.info?.(`[hybrid] ⚡ first sentence ready in ${firstSentenceAt - llmStart}ms: "${sentence.slice(0, 60)}…"`);
                        }

                        // Strip action codes and thinking blocks from TTS text
                        const ttsSentence = sentence
                            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
                            .replace(/\[[A-Z0-9_:]+\]/gi, '')
                            .trim();

                        if (ttsSentence && ttsSentence.length > 2) {
                            // v6.0: streamingSentence=true skips side-effects in speakAssistant
                            await speakAssistant(ttsSentence, { streamingSentence: true });
                        }
                    }
                });
                const llmMs = Date.now() - llmStart;
                ttsMs = Date.now() - ttsStart;
                totalTtsMs += ttsMs;

                // Send ai_end mark after all sentences are done
                if (sentenceCount > 0) {
                    try {
                        socket.send(JSON.stringify({ event: 'mark', streamSid, mark: { name: 'ai_end' } }));
                    } catch { /* ignore */ }
                }

                // v3.0: Check again after LLM+TTS streaming completes
                if (myTurnId !== currentTurnId) {
                    log.info?.(`[hybrid] 🚫 Turn ${myTurnId} cancelled after streaming by newer turn ${currentTurnId}`);
                    return;
                }

                // v5.0: Extract internal thoughts (<thinking>...</thinking>) from full response
                let thoughts = '';
                let cleanReply = fullReply || '';
                const thinkingMatch = cleanReply.match(/<thinking>([\s\S]*?)<\/thinking>/i);
                if (thinkingMatch) {
                    thoughts = thinkingMatch[1].trim();
                    cleanReply = cleanReply.replace(/<thinking>[\s\S]*?<\/thinking>/i, '').trim();
                }

                // Remove any leftover action tags or brackets
                const ttsCleanReply = cleanReply.replace(/\[[A-Z0-9_:]+\]/gi, '').trim();

                log.info?.(`[hybrid] cognitive thoughts: "${thoughts || 'none'}"`);
                log.info?.(`[hybrid] assistant: ${maskPii(ttsCleanReply).slice(0, 120)}… (LLM: ${llmMs}ms, sentences: ${sentenceCount})`);

                // Persist in history for future turns
                history.push({ role: 'user', content: userText });
                history.push({ role: 'assistant', content: ttsCleanReply });

                // v6.0: Handle action codes from the FULL response (not per-sentence)
                // This fixes BUG 2: action codes were stripped before speakAssistant could see them
                const actionCodes = (cleanReply.match(/\[[A-Z0-9_]+\]/g) || []).map(c => c.replace(/[\[\]]/g, ''));
                for (const code of actionCodes) firedActions.add(code);

                // Also check the raw fullReply for action codes (in case they were in thinking blocks etc.)
                const rawActionCodes = ((fullReply || '').match(/\[[A-Z0-9_]+\]/g) || []).map(c => c.replace(/[\[\]]/g, ''));
                for (const code of rawActionCodes) firedActions.add(code);

                // Inject action-completion system notes — prevents repeat loops
                if (firedActions.has('SEND_DEMO_SMS')) {
                    // Only inject if not already injected
                    const alreadyInjected = history.some(h => h.role === 'system' && h.content.includes('Demo SMS has been sent'));
                    if (!alreadyInjected) {
                        history.push({
                            role: 'system',
                            content: 'SYSTEM: Demo SMS has been sent successfully. Do NOT say [SEND_DEMO_SMS] again. If the user asks more questions, answer them naturally. Otherwise say goodbye and end the call.'
                        });
                    }
                }
                if (firedActions.has('DO_NOT_CALL')) {
                    const alreadyInjected = history.some(h => h.role === 'system' && h.content.includes('do-not-call'));
                    if (!alreadyInjected) {
                        history.push({
                            role: 'system',
                            content: 'SYSTEM: User has been marked do-not-call. Say a brief goodbye and stop talking.'
                        });
                        callEnding = true;
                        autoHangup('do_not_call');
                    }
                }

                // Auto-detect implicit SMS intent from the full response
                if (!firedActions.has('SEND_DEMO_SMS')) {
                    if (/(text|sms|send).*(demo|portfolio|preview)|(texted|texting|sending).*(demo|portfolio|preview)/i.test(ttsCleanReply)) {
                        log.info?.('[hybrid] 💡 Auto-detected implicit demo SMS intent from full response');
                        firedActions.add('SEND_DEMO_SMS');
                        if (processTranscript) {
                            await processTranscript('[SEND_DEMO_SMS]', lead, { reason: 'auto_detected_sms' });
                        }
                    }
                }

                // v6.0: Goodbye detection on the FULL response (fixes BUG 5: false triggers on partial sentences)
                const lowerFullReply = ttsCleanReply.toLowerCase();
                const hardGoodbye = /\b(goodbye|bye[\s-]?bye|bye then)\b/i.test(lowerFullReply);
                const softGoodbye =
                    turnCount >= 5 &&
                    /\b(talk soon|take care|have a (great|good|nice) (day|one|evening|night)|have a good one)\b/i.test(lowerFullReply) &&
                    !/\b(question|demo|link|price|cost|how much|tell me|what|show|send|can you|do you|is there)\b/i.test(lowerFullReply);

                if (!callEnding && (hardGoodbye || softGoodbye)) {
                    callEnding = true;
                    autoHangup('goodbye_detected');
                }

                // Record assistant turn in transcript
                transcript.push({
                    role: 'assistant',
                    text: ttsCleanReply,
                    thoughts,
                    at: new Date().toISOString(),
                    llmMs,
                    ttsMs,
                    firstSentenceMs: firstSentenceAt ? firstSentenceAt - llmStart : null,
                    sentenceCount
                });

                // Calculate Turn-based Conversation Analytics & Lead Score
                const userWords = userText.split(/\s+/).filter(Boolean).length;
                const assistantWords = ttsCleanReply.split(/\s+/).filter(Boolean).length;
                const totalWords = userWords + assistantWords;
                const talkRatio = totalWords > 0 ? userWords / totalWords : 0.5;

                let dropRisk = 'low';
                if (emotion.emotion === 'ANGRY') dropRisk = 'high';
                else if (turnCount > 7) dropRisk = 'medium';

                const sentimentScore = emotion.weight || 0;
                const currentScore = lead?.leadScore || 0;
                const finalScore = Math.min(100, Math.max(0, currentScore + sentimentScore));
                if (lead) lead.leadScore = finalScore;

                // Sync snapshot directly with store.json
                const callSid = lead?.callSid;
                if (callSid) {
                    const store = require('./store');
                    store.upsertConversation(callSid, {
                        stage: plan.stage,
                        emotion: emotion.emotion,
                        lastIntent: intent,
                        leadScore: finalScore,
                        thoughts,
                        analytics: {
                            engagement: finalScore > 50 ? 'high' : 'medium',
                            dropRisk,
                            talkRatio: Number(talkRatio.toFixed(2)),
                            turnCount
                        },
                        history: history.slice(-8)
                    });

                    // Update lead stage in caller tracking
                    store.setCall(callSid, {
                        stage: plan.stage,
                        leadScore: finalScore
                    });
                }

                // Trim history and increment turn counter ONCE per turn
                if (history.length > 20) history = history.slice(-20);
                turnCount++;

                // Track turn latency (total time from user speech end to AI audio start)
                turnLatencies.push(Date.now() - turnStart);
                log.info?.(`[hybrid] ⏱ turn ${turnCount}: STT=${sttMs}ms LLM=${llmMs}ms TTS=${ttsMs}ms firstAudio=${firstSentenceAt ? firstSentenceAt - llmStart : '?'}ms total=${Date.now() - turnStart}ms`);

            } finally {
                // v6.0: Clear speaking flag after entire streaming pipeline completes
                speaking = false;
            }
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
        // Protect opening greeting (turnCount === 0) and initial calibration frames from line setup noise
        if (speaking && turnCount > 0 && noiseFloorCalibrated && energy >= threshold * BARGE_IN_ENERGY_MULT) {
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
                processing = false; // Release processing lock immediately on barge-in
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

    const handleMessage = async (message) => {
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
                    setTimeout(() => {
                        speakAssistant(opening, { isOpening: true }).catch((e) =>
                            log.error?.({ e }, 'Opening TTS error')
                        );
                    }, 800);
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
                cleanupListeners();
                saveCallSummary();
                log.info?.('[hybrid] media stop');
            }
        } catch (err) {
            log.error?.({ err }, 'Hybrid media message error');
        }
    };

    const handleClose = () => {
        closed = true;
        clearInterval(callTimeoutInterval);
        cleanupListeners();
        saveCallSummary();
    };

    const handleError = () => {
        closed = true;
        clearInterval(callTimeoutInterval);
        cleanupListeners();
    };

    function cleanupListeners() {
        try {
            socket.removeListener('message', handleMessage);
            socket.removeListener('close', handleClose);
            socket.removeListener('error', handleError);
        } catch { /* ignore listener cleanup error */ }
    }

    socket.on('message', handleMessage);
    socket.on('close', handleClose);
    socket.on('error', handleError);

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

        // v5.0: Self-learning — record call outcome for AI improvement
        try {
            const lastEmotion = transcript.filter(t => t.role === 'user').slice(-1)[0];
            let outcome = 'hangup';
            if (firedActions.has('SEND_DEMO_SMS')) outcome = 'demo_sent';
            if (firedActions.has('BOOK_APPOINTMENT') || firedActions.has('SCHEDULE_CALLBACK')) outcome = 'callback_scheduled';
            if (firedActions.has('SEND_INVOICE') || firedActions.has('PAYMENT_LINK')) outcome = 'converted';
            if (firedActions.has('DO_NOT_CALL')) outcome = 'objection_stuck';

            recordCallOutcome({
                callSid,
                outcome,
                industry: lead?.industry || 'general',
                durationSeconds: Number(durationSec),
                turnCount,
                hookUsed: lead?.hookUsed || '',
                objectionsEncountered: [],
                questionsAsked: [],
                closingSignalsDetected: [],
                leadScore: lead?.leadScore || 0
            });
            log.info?.(`[hybrid] 🧠 Self-learning: recorded outcome=${outcome} industry=${lead?.industry || 'general'}`);
        } catch (err) {
            log.warn?.({ err }, '[hybrid] self-learning record failed');
        }

        // v5.0: Clear objection tracking for this call
        if (callSid) clearCallObjections(callSid);
    }
}

module.exports = {
    hybridConfig,
    attachHybridMediaHandler,
    transcribeWav,
    chatCompletion,
    chatCompletionStreaming,
    synthesizeMulaw,
    synthesizeMulawStreaming
};
