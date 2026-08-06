const { EventEmitter } = require('events');

function createEventBus() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(200);

  return {
    emit(eventName, payload = {}) {
      emitter.emit(eventName, payload);
      return payload;
    },
    on(eventName, listener) {
      emitter.on(eventName, listener);
      return () => emitter.off(eventName, listener);
    },
    once(eventName, listener) {
      emitter.once(eventName, listener);
      return () => emitter.off(eventName, listener);
    },
    off(eventName, listener) {
      emitter.off(eventName, listener);
    },
    listeners(eventName) {
      return emitter.listeners(eventName);
    }
  };
}

module.exports = {
  createEventBus
};
