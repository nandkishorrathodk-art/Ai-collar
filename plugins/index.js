/**
 * Lightweight plugin registry for provider-agnostic execution.
 */

const sms = require('./sms');
const calendar = require('./calendar');
const crm = require('./crm');
const payments = require('./payments');
const email = require('./email');
const receptionist = require('./receptionist');
const analytics = require('./analytics');

const registry = {
  sms,
  calendar,
  crm,
  payments,
  email,
  receptionist,
  analytics
};

function executePlugin(pluginName, context = {}, args = {}) {
  const normalized = String(pluginName || '').toLowerCase();
  const plugin = registry[normalized];
  if (!plugin) {
    return { ok: false, plugin: normalized, error: 'unknown_plugin' };
  }
  return plugin.execute(context, args);
}

module.exports = {
  registry,
  executePlugin
};
