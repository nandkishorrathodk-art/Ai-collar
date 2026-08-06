class ConversationSession {
  constructor({
    callSid = 'unknown',
    customer = {},
    memory = {},
    emotion = 'neutral',
    leadScore = 0,
    history = [],
    state = 'INIT',
    toolHistory = [],
    latency = {},
    provider = 'unknown',
    voice = 'unknown',
    language = 'en',
    variables = {},
    analytics = {}
  } = {}) {
    this.callSid = callSid;
    this.customer = { ...customer };
    this.memory = { ...memory };
    this.emotion = emotion;
    this.leadScore = leadScore;
    this.history = [...history];
    this.state = state;
    this.toolHistory = [...toolHistory];
    this.latency = { ...latency };
    this.provider = provider;
    this.voice = voice;
    this.language = language;
    this.variables = { ...variables };
    this.analytics = { ...analytics };
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
  }

  touch() {
    this.updatedAt = new Date().toISOString();
    return this;
  }

  setState(nextState) {
    this.state = nextState;
    this.touch();
    return this;
  }

  setEmotion(emotion) {
    this.emotion = emotion;
    this.touch();
    return this;
  }

  addHistory(entry) {
    this.history.push({ ...entry, at: entry.at || new Date().toISOString() });
    this.touch();
    return this;
  }

  addTool(toolName, result = {}) {
    this.toolHistory.push({ toolName, result, at: new Date().toISOString() });
    this.touch();
    return this;
  }

  updateMemory(partial = {}) {
    this.memory = { ...this.memory, ...partial };
    this.touch();
    return this;
  }

  toJSON() {
    return {
      callSid: this.callSid,
      customer: { ...this.customer },
      memory: { ...this.memory },
      emotion: this.emotion,
      leadScore: this.leadScore,
      history: [...this.history],
      state: this.state,
      toolHistory: [...this.toolHistory],
      latency: { ...this.latency },
      provider: this.provider,
      voice: this.voice,
      language: this.language,
      variables: { ...this.variables },
      analytics: { ...this.analytics },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = {
  ConversationSession
};
