/**
 * Payments plugin interface
 */
module.exports = {
  name: 'payments',
  execute(context = {}, args = {}) {
    return {
      ok: true,
      plugin: 'payments',
      action: 'prepare_invoice',
      amount: args.amount || context?.pricing?.amount || 0,
      context
    };
  }
};
