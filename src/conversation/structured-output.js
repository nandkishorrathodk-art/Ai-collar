function createStructuredLLMResponse({
  reply = '',
  intent = 'DISCOVERY',
  emotion = 'neutral',
  confidence = 0.9,
  tools = [],
  next_state = 'DISCOVERY'
} = {}) {
  return {
    reply,
    intent,
    emotion,
    confidence: Number(confidence || 0),
    tools: Array.isArray(tools) ? tools : [],
    next_state
  };
}

module.exports = {
  createStructuredLLMResponse
};
