/**
 * Analytics plugin interface
 */
module.exports = {
  name: 'analytics',
  execute(context = {}, args = {}) {
    return {
      ok: true,
      plugin: 'analytics',
      action: 'track_event',
      event: args.event || 'conversation_turn',
      context
    };
  }
};
