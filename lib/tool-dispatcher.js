/**
 * Structured Tool Execution Layer
 * Accepts tool objects such as:
 *  { tool: 'send_sms', args: { template: 'demo', phone: lead.phone } }
 * and dispatches them through the existing action runner / store pipeline.
 */

const DEFAULT_TOOL_PLAN = [
  { tool: 'send_sms', args: { template: 'demo' } },
  { tool: 'mark_hot_lead', args: {} }
];

function normalizeToolPlan(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.flatMap((item) => normalizeToolPlan(item));
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return normalizeToolPlan(parsed);
    } catch {
      return [{ tool: input, args: {} }];
    }
  }
  if (typeof input === 'object' && input.tool) {
    return [{ tool: String(input.tool).toLowerCase(), args: input.args || {} }];
  }
  return [];
}

function createToolDispatcher({ actionRunner, store, log = console, eventBus = null } = {}) {
  async function dispatch(plan, lead, meta = {}) {
    const normalized = normalizeToolPlan(plan);
    const results = [];

    // CRITICAL: never fall back to DEFAULT_TOOL_PLAN on empty input —
    // that used to auto-fire demo SMS + hot lead on every planner tick.
    if (!normalized.length) {
      log.info?.('[TOOLS] empty plan — nothing to dispatch');
      return results;
    }

    for (const item of normalized) {
      const tool = String(item.tool || '').toLowerCase();
      const args = item.args || {};
      const payload = { ...meta, ...args };

      try {
        switch (tool) {
          case 'send_sms': {
            const template = String(args.template || 'demo').toLowerCase();
            const code = template === 'pricing' ? 'SEND_PRICING' : template === 'payment' ? 'SEND_PAYMENT' : 'SEND_DEMO_SMS';
            const outcome = await actionRunner.handleAction(code, lead, payload);
            eventBus?.emit('TOOL_COMPLETED', {
              callSid: meta.callSid || lead?.callSid || 'system',
              tool,
              code,
              outcome
            });
            results.push({ ok: true, tool, code, outcome });
            break;
          }
          case 'book_demo': {
            const outcome = await actionRunner.handleAction('SEND_DEMO_SMS', lead, payload);
            eventBus?.emit('TOOL_COMPLETED', {
              callSid: meta.callSid || lead?.callSid || 'system',
              tool,
              outcome
            });
            results.push({ ok: true, tool, outcome });
            break;
          }
          case 'capture_email': {
            store.addEvent({ type: 'capture_email', phone: lead?.targetPhoneNumber || lead?.phone, payload });
            results.push({ ok: true, tool, outcome: { collected: true } });
            break;
          }
          case 'schedule_callback': {
            store.addEvent({ type: 'schedule_callback', phone: lead?.targetPhoneNumber || lead?.phone, payload });
            results.push({ ok: true, tool, outcome: { scheduled: true } });
            break;
          }
          case 'create_invoice': {
            const outcome = await actionRunner.handleAction('SEND_PAYMENT', lead, payload);
            eventBus?.emit('TOOL_COMPLETED', {
              callSid: meta.callSid || lead?.callSid || 'system',
              tool,
              outcome
            });
            results.push({ ok: true, tool, outcome });
            break;
          }
          case 'mark_hot_lead': {
            if (lead?.targetPhoneNumber || lead?.phone) {
              store.setLeadStage(lead.targetPhoneNumber || lead.phone, 'hot', { leadScore: 90 });
            }
            results.push({ ok: true, tool, outcome: { hotLead: true } });
            break;
          }
          case 'send_pricing': {
            const outcome = await actionRunner.handleAction('SEND_PRICING', lead, payload);
            eventBus?.emit('TOOL_COMPLETED', {
              callSid: meta.callSid || lead?.callSid || 'system',
              tool,
              outcome
            });
            results.push({ ok: true, tool, outcome });
            break;
          }
          case 'transfer_human': {
            store.addEvent({ type: 'transfer_human', phone: lead?.targetPhoneNumber || lead?.phone, payload });
            results.push({ ok: true, tool, outcome: { transferred: true } });
            break;
          }
          case 'send_calendar': {
            store.addEvent({ type: 'send_calendar', phone: lead?.targetPhoneNumber || lead?.phone, payload });
            results.push({ ok: true, tool, outcome: { calendarSent: true } });
            break;
          }
          case 'check_calendar': {
            store.addEvent({ type: 'check_calendar', phone: lead?.targetPhoneNumber || lead?.phone, payload });
            results.push({ ok: true, tool, outcome: { checked: true } });
            break;
          }
          case 'update_crm': {
            store.addEvent({ type: 'update_crm', phone: lead?.targetPhoneNumber || lead?.phone, payload });
            results.push({ ok: true, tool, outcome: { updated: true } });
            break;
          }
          case 'lookup_business': {
            store.addEvent({ type: 'lookup_business', phone: lead?.targetPhoneNumber || lead?.phone, payload });
            results.push({ ok: true, tool, outcome: { lookedUp: true } });
            break;
          }
          case 'check_existing_customer': {
            store.addEvent({ type: 'check_existing_customer', phone: lead?.targetPhoneNumber || lead?.phone, payload });
            results.push({ ok: true, tool, outcome: { checked: true } });
            break;
          }
          default:
            results.push({ ok: false, tool, error: 'unsupported_tool' });
        }
      } catch (err) {
        log.error?.({ err }, `Tool dispatch failed: ${tool}`);
        results.push({ ok: false, tool, error: err.message });
      }
    }

    return results;
  }

  return {
    dispatch,
    normalizeToolPlan
  };
}

module.exports = {
  DEFAULT_TOOL_PLAN,
  normalizeToolPlan,
  createToolDispatcher
};
