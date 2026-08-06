/**
 * STT Provider — speech-to-text abstraction.
 * Defaults to Groq Whisper (same engine already proven in lib/hybrid-voice.js).
 */
class STTProvider {
  constructor({
    apiKey = process.env.GROQ_API_KEY,
    model = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
    endpoint = 'https://api.groq.com/openai/v1/audio/transcriptions',
    log = console
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
    this.log = log;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * @param {Buffer} wavBuffer - mono 16-bit WAV audio
   * @param {{ language?: string, filename?: string }} opts
   * @returns {Promise<{ ok: boolean, text: string, raw?: object, error?: string }>}
   */
  async transcribe(wavBuffer, { language = 'en', filename = 'utterance.wav' } = {}) {
    if (!this.isConfigured()) {
      return { ok: false, text: '', error: `${this.constructor.name}: missing API key` };
    }
    if (!wavBuffer || !wavBuffer.length) {
      return { ok: false, text: '', error: 'empty audio buffer' };
    }

    try {
      const form = new FormData();
      form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), filename);
      form.append('model', this.model);
      form.append('language', language);
      form.append('response_format', 'json');

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`STT ${res.status}: ${errText.slice(0, 300)}`);
      }

      const data = await res.json();
      return { ok: true, text: (data.text || '').trim(), raw: data };
    } catch (err) {
      this.log.error?.({ err }, 'STTProvider.transcribe failed');
      return { ok: false, text: '', error: err.message };
    }
  }
}

module.exports = { STTProvider };
