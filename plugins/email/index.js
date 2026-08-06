/**
 * Email plugin interface
 */
module.exports = {
  name: 'email',
  execute(context = {}, args = {}) {
    return {
      ok: true,
      plugin: 'email',
      action: 'send_email',
      to: args.to || context?.lead?.email || null,
      subject: args.subject || 'Follow-up',
      context
    };
  }
};
