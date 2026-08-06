/**
 * TTS Provider — text-to-speech abstraction.
 * Primary: ElevenLabs (with automatic model fallback chain).
 * Secondary: Deepgram Aura, used only if ElevenLabs is unset/fails.
 * Mirrors the proven synthesizeMulaw() logic from lib/hybrid-voice.js.
 */
class TTSProvider {
  constructor({
    apiKey = process.env.ELEVENLABS_API_KEY,
    voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
    model = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5',
    fallbackModels = ['eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2'],
    deepgramKey = process.env.DEEPGRAM_API_KEY,
    log = console
  } = {}) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.model = model;
    this.fallbackModels = fallbackModels;
    this.deepgramKey = deepgramKey;
    this.log = log;
  }

  isConfigured() {
    return Boolean(this.apiKey || this.deepgramKey);
  }

  /**
   * @param {string} text
   * @param {{ outputFormat?: string, voiceSettings?: object }} opts
   * @returns {Promise<{ ok: boolean, audio: Buffer, model?: string, error?: string }>}
   */
  async speak(text, { outputFormat = 'ulaw_8000', voiceSettings } = {}) {
    const speakText = String(text || '')
      .replace(/\[[A-Z0-9_]+\]/gi, ' ')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!speakText) return { ok: true, audio: Buffer.alloc(0) };

    if (this.apiKey) {
      const modelsToTry = [this.model, ...this.fallbackModels].filter(
        (m, i, arr) => m && arr.indexOf(m) === i
      );
      let lastErr = '';
      for (const modelId of modelsToTry) {
        try {
          const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'xi-api-key': this.apiKey,
              'Content-Type': 'application/json',
              Accept: 'application/octet-stream'
            },
            body: JSON.stringify({
              text: speakText.slice(0, 900),
              model_id: modelId,
              voice_settings: voiceSettings || {
                stability: 0.72,
                similarity_boost: 0.85,
                style: 0.15,
                use_speaker_boost: true
              }
            })
          });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            // JSON error sometimes returns 200 with a tiny body — treat as failure
            if (buf.length > 50 && buf[0] !== 0x7b /* { */) {
              return { ok: true, audio: buf, model: modelId };
            }
            lastErr = `model ${modelId}: short/invalid body (${buf.length} bytes)`;
            continue;
          }
          const errText = await res.text().catch(() => '');
          lastErr = `ElevenLabs TTS ${res.status} model=${modelId}: ${errText.slice(0, 220)}`;
          // Permission errors won't fix by switching model
          if (res.status === 401 || res.status === 403) break;
        } catch (err) {
          lastErr = err.message;
        }
      }
      this.log.warn?.(`TTSProvider: ElevenLabs failed (${lastErr})`);
    }

    if (this.deepgramKey) {
      try {
        const encoding = outputFormat.startsWith('ulaw') ? 'mulaw' : 'linear16';
        const dgUrl = `https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=${encoding}&sample_rate=8000`;
        const res = await fetch(dgUrl, {
          method: 'POST',
          headers: {
            Authorization: `Token ${this.deepgramKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: speakText.slice(0, 900) })
        });
        if (res.ok) {
          return { ok: true, audio: Buffer.from(await res.arrayBuffer()), model: 'deepgram-aura' };
        }
      } catch (err) {
        this.log.warn?.(`TTSProvider: Deepgram fallback failed (${err.message})`);
      }
    }

    return {
      ok: false,
      audio: Buffer.alloc(0),
      error: 'TTS failed on all configured providers (ElevenLabs + Deepgram)'
    };
  }
}

module.exports = { TTSProvider };
