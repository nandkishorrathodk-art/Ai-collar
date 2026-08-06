function createContextSnapshot(session = {}, overrides = {}) {
  return {
    callSid: session.callSid || overrides.callSid || 'unknown',
    state: session.state || {},
    timeline: Array.isArray(session.timeline) ? session.timeline : [],
    ...overrides
  };
}

module.exports = {
  createContextSnapshot
};
