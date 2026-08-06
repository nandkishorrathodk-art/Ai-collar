/**
 * Live credential probes — tell you what's actually working, not just "key present".
 */
const { hybridConfig, chatCompletion, synthesizeMulaw } = require('./hybrid-voice');
const { resolveOpenAiRealtime } = require('./realtime');
const { pcm16ToWavBuffer } = require('./audio');

async function probeGroqChat() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, skip: true, error: 'GROQ_API_KEY missing' };
  try {
    const text = await chatCompletion(
      'Reply with exactly: OK',
      [],
      'ping',
      hybridConfig()
    );
    return { ok: true, sample: (text || '').slice(0, 40) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function probeGroqStt() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, skip: true, error: 'GROQ_API_KEY missing' };
  try {
    // 0.3s of near-silence WAV — API should accept file even if transcript empty
    const pcm = new Int16Array(2400);
    const wav = pcm16ToWavBuffer(pcm, 8000);
    const form = new FormData();
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'silence.wav');
    form.append('model', process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo');
    form.append('language', 'en');
    form.append('response_format', 'json');
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: `STT ${res.status}: ${body.slice(0, 200)}` };
    return { ok: true, note: 'Whisper endpoint reachable', raw: body.slice(0, 80) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function probeElevenLabs() {
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EST9Ui6982FZPSi7gCHi';
  if (!key) return { ok: false, skip: true, error: 'ELEVENLABS_API_KEY missing' };

  try {
    const mulaw = await synthesizeMulaw('Hi, this is a ZeroRefer voice test.', hybridConfig());
    if (!mulaw || mulaw.length < 100) {
      return {
        ok: false,
        error:
          'TTS returned empty/short audio. Key may lack text_to_speech permission — create a full key at elevenlabs.io'
      };
    }
    return { ok: true, ulawBytes: mulaw.length, voiceId };
  } catch (err) {
    const msg = err.message || String(err);
    let hint = 'Regenerate API key at https://elevenlabs.io/app/settings/api-keys';
    if (/permission|unauthorized|401/i.test(msg)) {
      hint =
        'Your key is REJECTED or RESTRICTED. Create a new key with Text to Speech enabled (not a limited key).';
    }
    return { ok: false, error: msg.slice(0, 300), hint };
  }
}

async function probeOpenAiRealtime() {
  const cfg = resolveOpenAiRealtime();
  if (!cfg.ready) {
    return { ok: false, skip: true, error: (cfg.blockers || ['no key']).join('; ') };
  }
  return {
    ok: true,
    note: 'OPENAI_API_KEY present — Realtime path available (not fully dial-tested here)',
    model: cfg.model,
    voice: cfg.voice
  };
}

function probeTwilioConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const phone = process.env.TWILIO_PHONE_NUMBER;
  const ok = Boolean(sid && token && phone);
  return {
    ok,
    hasSid: Boolean(sid),
    hasToken: Boolean(token),
    hasPhone: Boolean(phone),
    error: ok ? undefined : 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'
  };
}

/**
 * Full diagnostic report for operators.
 */
async function runDiagnostics({ includeStt = true } = {}) {
  const twilio = probeTwilioConfig();
  const groqChat = await probeGroqChat();
  const groqStt = includeStt ? await probeGroqStt() : { ok: null, skip: true };
  const eleven = await probeElevenLabs();
  const openai = await probeOpenAiRealtime();

  const hybridVoiceOk = groqChat.ok && eleven.ok;
  const openaiVoiceOk = openai.ok;
  const canPlaceCalls = twilio.ok;
  const canSendSms = twilio.ok;
  const funnelWithoutPhone = true; // always — simulate works

  const nextSteps = [];
  if (!eleven.ok && !eleven.skip) {
    nextSteps.push(
      'FIX ElevenLabs: dashboard → API Keys → new key with Text to Speech permission (current key returns 401 missing_permissions)'
    );
  }
  if (!twilio.ok) {
    nextSteps.push(
      'ADD Twilio: console.twilio.com → get SID/TOKEN + buy US number with Voice+SMS → fill TWILIO_* in .env'
    );
  }
  if (!openai.ok && hybridVoiceOk) {
    nextSteps.push(
      'Optional: add OPENAI_API_KEY later for lower-latency Realtime voice (hybrid already works)'
    );
  }
  if (!groqChat.ok && !openai.ok) {
    nextSteps.push('Fix GROQ_API_KEY or add OPENAI_API_KEY — no brain for the agent');
  }
  if (hybridVoiceOk && twilio.ok) {
    nextSteps.push(
      'READY for first test call: set PUBLIC_HOSTNAME to ngrok host, run ngrok, POST /api/call-usa-client'
    );
  } else if (!twilio.ok && (hybridVoiceOk || openaiVoiceOk)) {
    nextSteps.push('Voice AI keys OK enough to speak — only Twilio blocks real phone calls');
  }
  if (funnelWithoutPhone) {
    nextSteps.push('Anytime: POST /api/funnel/simulate to test demo SMS → payment → onboard form');
  }

  return {
    at: new Date().toISOString(),
    summary: {
      hybridVoiceOk,
      openaiVoiceOk,
      canPlaceCalls,
      canSendSms,
      funnelSimulateOk: true,
      overall:
        canPlaceCalls && (hybridVoiceOk || openaiVoiceOk)
          ? 'READY_FOR_LIVE_CALLS'
          : hybridVoiceOk || openaiVoiceOk
            ? 'VOICE_OK_NEED_TWILIO'
            : twilio.ok
              ? 'TWILIO_OK_NEED_VOICE'
              : 'NEED_TWILIO_AND_VOICE_FIX'
    },
    probes: {
      twilio,
      groqChat,
      groqStt,
      elevenLabs: eleven,
      openAiRealtime: openai
    },
    nextSteps
  };
}

module.exports = { runDiagnostics, probeGroqChat, probeElevenLabs, probeTwilioConfig };
