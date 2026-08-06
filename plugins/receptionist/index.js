/**
 * Receptionist plugin interface
 */
module.exports = {
  name: 'receptionist',
  execute(context = {}, args = {}) {
    return {
      ok: true,
      plugin: 'receptionist',
      action: 'answer_call',
      business: args.business || context?.lead?.clientName || null,
      context
    };
  }
};
