/**
 * SMS plugin interface
 */
module.exports = {
  name: 'sms',
  execute(context = {}, args = {}) {
    return {
      ok: true,
      plugin: 'sms',
      action: 'send',
      to: args.phone || context?.lead?.phone || null,
      template: args.template || 'demo',
      context
    };
  }
};
