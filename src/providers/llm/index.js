/**
 * LLM Provider — chat-completion abstraction.
 *
 * Defaults to Groq (same engine already proven in lib/hybrid-voice.js),
 * but works with any OpenAI-compatible chat/completions endpoint
 * (set baseUrl to point at OpenAI, a self-hosted proxy, etc.).
 */
class LLMProvider {
  constructor({
    apiKey = process.env.GROQ_API_KEY,
    baseUrl = process.env.CUSTOM_LLM_BASE_URL || 'https://api.groq.com/openai/v1',
    model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    log = console
  } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
    this.model = model;
    this.log = log;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * @param {{ systemPrompt?: string, messages?: Array<{role: string, content: string}>, temperature?: number, maxTokens?: number }} opts
   * @returns {Promise<{ ok: boolean, text: string, raw?: object, error?: string }>}
   */
  async complete({ systemPrompt = '', messages = [], temperature = 0.6, maxTokens = 300 } = {}) {
    if (!this.isConfigured()) {
      return { ok: false, text: '', error: `${this.constructor.name}: missing API key` };
    }

    const payloadMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    if (!payloadMessages.length) {
      return { ok: false, text: '', error: `${this.constructor.name}: no messages provided` };
    }

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: payloadMessages,
          temperature,
          max_tokens: maxTokens
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`LLM ${res.status}: ${errText.slice(0, 300)}`);
      }

      const data = await res.json();
      const text = (data.choices?.[0]?.message?.content || '').trim();
      return { ok: true, text, raw: data };
    } catch (err) {
      this.log.error?.({ err }, 'LLMProvider.complete failed');
      return { ok: false, text: '', error: err.message };
    }
  }
}

module.exports = { LLMProvider };
