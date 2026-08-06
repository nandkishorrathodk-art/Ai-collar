function createSessionRuntime({ eventBus, store } = {}) {
  const sessions = new Map();

  function createSession(callSid, seed = {}) {
    const session = {
      callSid,
      state: seed,
      events: [],
      timeline: []
    };
    sessions.set(callSid, session);
    return session;
  }

  function getSession(callSid) {
    return sessions.get(callSid) || createSession(callSid, { createdAt: new Date().toISOString() });
  }

  function record(eventName, payload = {}) {
    const session = getSession(payload.callSid || 'system');
    session.events.push({ eventName, payload, at: new Date().toISOString() });
    eventBus?.emit(eventName, { ...payload, callSid: payload.callSid || session.callSid });
    if (store?.addEvent) {
      store.addEvent({ type: eventName, ...payload, callSid: payload.callSid || session.callSid });
    }
    return session;
  }

  return {
    createSession,
    getSession,
    record
  };
}

module.exports = { createSessionRuntime };
