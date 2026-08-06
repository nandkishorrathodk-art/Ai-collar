const { STTProvider } = require('../stt');
const { LLMProvider } = require('../llm');
const { TTSProvider } = require('../tts');

/**
 * VoiceProvider — composite turn-based voice engine (STT -> LLM -> TTS).
 * Not Twilio-aware — it's a reusable façade over the three underlying
 * providers, useful for testing, diagnostics, or non-telephony voice UIs.
 * The live Twilio call path (lib/hybrid-voice.js / lib/realtime.js) has its
 * own low-latency streaming implementation and does not depend on this class.
 */
class VoiceProvider {
  constructor({ stt, llm, tts, log = console } = {}) {
    this.stt = stt || new STTProvider({ log });
    this.llm = llm || new LLMProvider({ log });
    this.tts = tts || new TTSProvider({ log });
    this.log = log;
    this.connected = false;
  }

  isConfigured() {
    return this.stt.isConfigured() && this.llm.isConfigured() && this.tts.isConfigured();
  }

  async connect() {
    this.connected = true;
    return { ok: true, connected: true, configured: this.isConfigured() };
  }

  /** @param {Buffer} wavBuffer */
  async transcribe(wavBuffer, opts = {}) {
    return this.stt.transcribe(wavBuffer, opts);
  }

  /** @param {{ systemPrompt?: string, messages?: Array }} opts */
  async respond(opts = {}) {
    return this.llm.complete(opts);
  }

  /** @param {string} text */
  async speak(text, opts = {}) {
    return this.tts.speak(text, opts);
  }

  /**
   * Convenience: one full turn — audio in, spoken audio out.
   * @param {{ wavBuffer: Buffer, systemPrompt?: string, messages?: Array, ttsOpts?: object }} opts
   */
  async turn({ wavBuffer, systemPrompt = '', messages = [], ttsOpts = {} } = {}) {
    const sttResult = await this.transcribe(wavBuffer);
    if (!sttResult.ok || !sttResult.text) {
      return { ok: false, stage: 'stt', ...sttResult };
    }

    const llmResult = await this.respond({
      systemPrompt,
      messages: [...messages, { role: 'user', content: sttResult.text }]
    });
    if (!llmResult.ok || !llmResult.text) {
      return { ok: false, stage: 'llm', userText: sttResult.text, ...llmResult };
    }

    const ttsResult = await this.speak(llmResult.text, ttsOpts);
    return {
      ok: ttsResult.ok,
      stage: ttsResult.ok ? 'done' : 'tts',
      userText: sttResult.text,
      replyText: llmResult.text,
      audio: ttsResult.audio,
      error: ttsResult.error
    };
  }

  async close() {
    this.connected = false;
    return { ok: true, connected: false };
  }
}

module.exports = { VoiceProvider };
