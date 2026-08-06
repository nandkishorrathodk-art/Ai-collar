/**
 * Calendar plugin interface
 */
module.exports = {
  name: 'calendar',
  execute(context = {}, args = {}) {
    return {
      ok: true,
      plugin: 'calendar',
      action: 'schedule',
      slot: args.slot || null,
      context
    };
  }
};
