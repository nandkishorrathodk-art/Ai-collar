/**
 * TTS ENGINE v1.0 — Unified Multi-Engine Text-to-Speech with Auto-Failover
 * 
 * Architecture:
 *   Primary:   ElevenLabs (eleven_flash_v2_5) — lowest latency, best quality
 *   Fallback1: Deepgram Aura (aura-asteria-en) — ultra-fast, real-time optimized
 *   Fallback2: Google Cloud TTS (en-US-Neural2-F) — free tier, ultra-reliable
 *
 * Features:
 *   ✓ Auto-failover cascade with per-engine health tracking
 *   ✓ Latency tracking per engine for smart routing
 *   ✓ SSML prosody support for pauses, emphasis, emotion
 *   ✓ Streaming + non-streaming modes
 *   ✓ Phone-optimized voice settings (ulaw_8000)
 */

const { sanitizeForHumanSpeech } = require('../prompts');

// ── Engine health tracking ──────────────────────────────────────────────
const engineHealth = {
  elevenlabs: { available: false, avgLatencyMs: 0, totalCalls: 0, failures: 0, lastError: '', lastCheckAt: 0 },
  deepgram:   { available: false, avgLatencyMs: 0, totalCalls: 0, failures: 0, lastError: '', lastCheckAt: 0 },
  google:     { available: false, avgLatencyMs: 0, totalCalls: 0, failures: 0, lastError: '', lastCheckAt: 0 }
};

function updateEngineHealth(engine, success, latencyMs = 0, error = '') {
  const h = engineHealth[engine];
  if (!h) return;
  h.totalCalls++;
  h.lastCheckAt = Date.now();
  if (success) {
    h.available = true;
    h.avgLatencyMs = h.totalCalls === 1
      ? latencyMs
      : Math.round(h.avgLatencyMs * 0.7 + latencyMs * 0.3);
  } else {
    h.failures++;
    h.lastError = error;
    // Mark unavailable after 3 consecutive failures
    if (h.failures >= 3 && h.totalCalls - h.failures < 1) {
      h.available = false;
    }
  }
}

function resetEngineHealth(engine) {
  if (engineHealth[engine]) {
    engineHealth[engine].failures = 0;
    engineHealth[engine].available = true;
  }
}

function getEngineHealth() {
  return { ...engineHealth };
}

// ── Voice Configurations ────────────────────────────────────────────────
const VOICE_PROFILES = {
  professional_female: {
    elevenlabs: {
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9', // Jessica — Warm, Friendly, Natural American Female
      stability: 0.38,       // Balanced stability for zero robotic artifacts + natural emotion
      similarity_boost: 0.85, // High clarity audio over phone lines
      style: 0.45,            // Warm conversational expressiveness
      use_speaker_boost: true
    },
    deepgram: { model: process.env.DEEPGRAM_MODEL || 'flux-maeve-en' },
    google: { name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' }
  }
};

// ── Text Cleaning & SSML ────────────────────────────────────────────────
function cleanTextForTTS(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\[([A-Z0-9_]+)\]/gi, ' ')          // Strip emit codes
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '') // Strip thinking blocks
    .replace(/https?:\/\/\S+/gi, '')              // Don't speak URLs
    .replace(/\*+/g, '')                          // Strip markdown bold/italic
    .replace(/#{1,6}\s/g, '')                     // Strip markdown headers
    .replace(/\s+/g, ' ')
    .trim();
}

function addSSMLProsody(text) {
  if (!text) return text;
  let ssml = text;
  // Add breath pause after commas
  ssml = ssml.replace(/,\s/g, ', ');
  // Add slight pause after em-dash
  ssml = ssml.replace(/\s—\s/g, '... ');
  // Add micro-pause before question marks for natural rising intonation
  ssml = ssml.replace(/\?/g, '?');
  return ssml;
}

// ── ElevenLabs TTS ──────────────────────────────────────────────────────
async function synthesizeElevenLabs(text, cfg, { signal } = {}) {
  const profile = VOICE_PROFILES.professional_female.elevenlabs;
  const voiceId = cfg.voice || profile.voiceId;
  const modelsToTry = [
    'eleven_flash_v2_5',
    cfg.ttsModel || 'eleven_turbo_v2_5',
    'eleven_multilingual_v2'
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastErr = '';
  for (const modelId of modelsToTry) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=ulaw_8000&optimize_streaming_latency=4`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': cfg.elevenKey,
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream'
        },
        body: JSON.stringify({
          text: text.slice(0, 900),
          model_id: modelId,
          voice_settings: {
            stability: profile.stability,
            similarity_boost: profile.similarity_boost,
            style: profile.style,
            use_speaker_boost: profile.use_speaker_boost
          }
        }),
        signal
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastErr = `ElevenLabs ${res.status} model=${modelId}: ${errText.slice(0, 220)}`;
        updateEngineHealth('elevenlabs', false, Date.now() - start, lastErr);
        if (res.status === 401 || res.status === 403) break;
        continue;
      }

      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length > 50 && buf[0] !== 0x7b) {
        updateEngineHealth('elevenlabs', true, Date.now() - start);
        return buf;
      }
      lastErr = `model ${modelId}: short/invalid body (${buf.length} bytes)`;
      continue;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastErr = `model ${modelId}: ${err.message}`;
    }
  }
  updateEngineHealth('elevenlabs', false, 0, lastErr);
  throw new Error(lastErr || 'ElevenLabs TTS failed');
}

// ── ElevenLabs Streaming TTS ────────────────────────────────────────────
async function synthesizeElevenLabsStreaming(text, cfg, { onChunk, signal } = {}) {
  const profile = VOICE_PROFILES.professional_female.elevenlabs;
  const voiceId = cfg.voice || profile.voiceId;
  const modelsToTry = [
    'eleven_flash_v2_5',
    cfg.ttsModel || 'eleven_turbo_v2_5',
    'eleven_multilingual_v2'
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastErr = '';
  for (const modelId of modelsToTry) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=ulaw_8000&optimize_streaming_latency=4`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': cfg.elevenKey,
          'Content-Type': 'application/json',
          Accept: 'application/octet-stream'
        },
        body: JSON.stringify({
          text: text.slice(0, 900),
          model_id: modelId,
          voice_settings: {
            stability: profile.stability,
            similarity_boost: profile.similarity_boost,
            style: profile.style,
            use_speaker_boost: profile.use_speaker_boost
          }
        }),
        signal
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastErr = `ElevenLabs ${res.status} model=${modelId}: ${errText.slice(0, 220)}`;
        if (res.status === 401 || res.status === 403) break;
        continue;
      }

      const reader = res.body.getReader();
      let totalBytes = 0;
      let validated = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value);
          if (!validated) {
            if (chunk.length > 0 && chunk[0] === 0x7b) {
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

      if (totalBytes > 50) {
        updateEngineHealth('elevenlabs', true, Date.now() - start);
        return totalBytes;
      }
      if (!validated) continue;
      lastErr = `model ${modelId}: short/invalid body (${totalBytes} bytes)`;
      continue;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastErr = `model ${modelId}: ${err.message}`;
      continue;
    }
  }
  updateEngineHealth('elevenlabs', false, 0, lastErr);
  throw new Error(lastErr || 'ElevenLabs streaming TTS failed');
}

// ── Deepgram Aura TTS ───────────────────────────────────────────────────
async function synthesizeDeepgram(text, cfg, { signal } = {}) {
  if (!process.env.DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not set');
  const start = Date.now();
  const model = process.env.DEEPGRAM_MODEL || 'flux-maeve-en';
  const apiVer = model.startsWith('flux-') ? 'v2' : 'v1';
  const dgUrl = `https://api.deepgram.com/${apiVer}/speak?model=${encodeURIComponent(model)}&encoding=mulaw&sample_rate=8000`;
  try {
    const res = await fetch(dgUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text.slice(0, 900) }),
      signal
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // Fallback to aura-asteria-en on v1/speak if flux model fails
      if (model.startsWith('flux-')) {
        const fallbackUrl = 'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&sample_rate=8000';
        const fbRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: text.slice(0, 900) }),
          signal
        });
        if (fbRes.ok) {
          const ab = await fbRes.arrayBuffer();
          const buf = Buffer.from(ab);
          updateEngineHealth('deepgram', true, Date.now() - start);
          return buf;
        }
      }
      const error = `Deepgram TTS ${res.status}: ${errText.slice(0, 220)}`;
      updateEngineHealth('deepgram', false, Date.now() - start, error);
      throw new Error(error);
    }
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    if (buf.length > 50) {
      updateEngineHealth('deepgram', true, Date.now() - start);
      return buf;
    }
    throw new Error('Deepgram: empty/short response');
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    updateEngineHealth('deepgram', false, Date.now() - start, err.message);
    throw err;
  }
}

// ── Google Cloud TTS ────────────────────────────────────────────────────
async function synthesizeGoogle(text, cfg, { signal } = {}) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_TTS_API_KEY not set');
  const start = Date.now();
  const profile = VOICE_PROFILES.professional_female.google;
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: text.slice(0, 900) },
        voice: {
          languageCode: 'en-US',
          name: profile.name,
          ssmlGender: profile.ssmlGender
        },
        audioConfig: {
          audioEncoding: 'MULAW',
          sampleRateHertz: 8000,
          speakingRate: 1.0,
          pitch: 0
        }
      }),
      signal
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const error = `Google TTS ${res.status}: ${errText.slice(0, 220)}`;
      updateEngineHealth('google', false, Date.now() - start, error);
      throw new Error(error);
    }
    const data = await res.json();
    if (!data.audioContent) throw new Error('Google TTS: no audio content');
    const buf = Buffer.from(data.audioContent, 'base64');
    updateEngineHealth('google', true, Date.now() - start);
    return buf;
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    updateEngineHealth('google', false, Date.now() - start, err.message);
    throw err;
  }
}

// ── Failover Cascade Engine ─────────────────────────────────────────────

/**
 * Synthesize speech with automatic failover cascade.
 * Order: ElevenLabs → Deepgram → Google TTS
 * @param {string} rawText - Raw AI response text (may contain emit codes)
 * @param {object} cfg - Config from hybridConfig()
 * @param {object} opts - { signal, streaming, onChunk }
 * @returns {Buffer|number} Audio buffer (non-streaming) or total bytes (streaming)
 */
async function synthesizeWithFailover(rawText, cfg, { signal, streaming = false, onChunk } = {}) {
  const cleanText = cleanTextForTTS(rawText);
  const speakText = sanitizeForHumanSpeech(addSSMLProsody(cleanText));
  if (!speakText) return streaming ? 0 : Buffer.alloc(0);

  const engines = getFailoverOrder();
  const errors = [];

  for (const engine of engines) {
    try {
      switch (engine) {
        case 'elevenlabs':
          if (!cfg.elevenKey) continue;
          if (streaming && onChunk) {
            return await synthesizeElevenLabsStreaming(speakText, cfg, { onChunk, signal });
          }
          return await synthesizeElevenLabs(speakText, cfg, { signal });

        case 'deepgram':
          if (!process.env.DEEPGRAM_API_KEY) continue;
          const dgBuf = await synthesizeDeepgram(speakText, cfg, { signal });
          if (streaming && onChunk) {
            await onChunk(dgBuf);
            return dgBuf.length;
          }
          return dgBuf;

        case 'google':
          if (!process.env.GOOGLE_TTS_API_KEY) continue;
          const gBuf = await synthesizeGoogle(speakText, cfg, { signal });
          if (streaming && onChunk) {
            await onChunk(gBuf);
            return gBuf.length;
          }
          return gBuf;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      errors.push(`[${engine}] ${err.message}`);
      continue;
    }
  }

  throw new Error(
    `All TTS engines failed:\n${errors.join('\n') || 'No engines configured. Set ELEVENLABS_API_KEY, DEEPGRAM_API_KEY, or GOOGLE_TTS_API_KEY.'}`
  );
}

/**
 * Get failover order based on engine health and configuration.
 * Primary preference: ElevenLabs → Deepgram → Google
 * But if an engine has high failure rate, demote it.
 */
function getFailoverOrder() {
  const primary = (process.env.TTS_PRIMARY || 'elevenlabs').toLowerCase();
  const baseOrder = ['elevenlabs', 'deepgram', 'google'];

  // Move primary to front
  const ordered = [primary, ...baseOrder.filter(e => e !== primary)];

  // Demote engines with high failure rates (but never remove them — they may recover)
  return ordered.sort((a, b) => {
    const ha = engineHealth[a] || {};
    const hb = engineHealth[b] || {};
    // Keep primary first if healthy
    if (a === primary && ha.available !== false) return -1;
    if (b === primary && hb.available !== false) return 1;
    // Sort by availability, then latency
    if (ha.available && !hb.available) return -1;
    if (!ha.available && hb.available) return 1;
    return (ha.avgLatencyMs || 9999) - (hb.avgLatencyMs || 9999);
  });
}

// ── Health Check ────────────────────────────────────────────────────────
function getTTSHealthReport(cfg) {
  const engines = [];

  // ElevenLabs
  engines.push({
    name: 'ElevenLabs',
    id: 'elevenlabs',
    configured: Boolean(cfg.elevenKey),
    model: cfg.ttsModel || 'eleven_flash_v2_5',
    voice: cfg.voice,
    ...engineHealth.elevenlabs
  });

  // Deepgram
  engines.push({
    name: 'Deepgram Aura',
    id: 'deepgram',
    configured: Boolean(process.env.DEEPGRAM_API_KEY),
    model: 'aura-asteria-en',
    ...engineHealth.deepgram
  });

  // Google
  engines.push({
    name: 'Google Cloud TTS',
    id: 'google',
    configured: Boolean(process.env.GOOGLE_TTS_API_KEY),
    model: 'en-US-Neural2-F',
    ...engineHealth.google
  });

  const configuredCount = engines.filter(e => e.configured).length;
  const failoverOrder = getFailoverOrder();

  return {
    status: configuredCount > 0 ? 'operational' : 'no_engines',
    configuredEngines: configuredCount,
    failoverOrder,
    engines,
    recommendation: configuredCount < 2
      ? 'Add more TTS engines for better reliability. Set DEEPGRAM_API_KEY or GOOGLE_TTS_API_KEY.'
      : configuredCount === 3
        ? 'All 3 engines configured — maximum reliability!'
        : 'Good — 2 engines configured for failover.'
  };
}

// ── Periodic health reset (every 5 minutes, give failed engines another chance) ──
setInterval(() => {
  for (const key of Object.keys(engineHealth)) {
    const h = engineHealth[key];
    if (!h.available && Date.now() - h.lastCheckAt > 5 * 60 * 1000) {
      h.available = true;
      h.failures = 0;
    }
  }
}, 5 * 60 * 1000);

module.exports = {
  synthesizeWithFailover,
  synthesizeElevenLabs,
  synthesizeElevenLabsStreaming,
  synthesizeDeepgram,
  synthesizeGoogle,
  cleanTextForTTS,
  addSSMLProsody,
  getEngineHealth,
  getTTSHealthReport,
  getFailoverOrder,
  updateEngineHealth,
  resetEngineHealth,
  VOICE_PROFILES
};
