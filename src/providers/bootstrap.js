/**
 * Registers the default AI providers (LLM / STT / TTS / Voice) into the
 * shared ProviderManager singleton. Safe to call once at boot — it only
 * registers provider *instances*; it does not change how the live Twilio
 * call path (lib/realtime.js, lib/hybrid-voice.js) works.
 */
const { providerManager } = require('./index');
const { LLMProvider } = require('./llm');
const { STTProvider } = require('./stt');
const { TTSProvider } = require('./tts');
const { VoiceProvider } = require('./voice');

function registerDefaultProviders({ log = console } = {}) {
  const llm = new LLMProvider({ log });
  const stt = new STTProvider({ log });
  const tts = new TTSProvider({ log });
  const voice = new VoiceProvider({ stt, llm, tts, log });

  providerManager.register('llm', 'groq', llm);
  providerManager.register('stt', 'groq', stt);
  providerManager.register('tts', 'elevenlabs', tts);
  providerManager.register('voice', 'hybrid', voice);

  return { llm, stt, tts, voice };
}

module.exports = { registerDefaultProviders };
