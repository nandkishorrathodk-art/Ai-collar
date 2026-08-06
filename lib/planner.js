/**
 * Planner / Supervisor layer
 * Responsible for deciding what to do next.
 * The LLM remains focused on what to say.
 */

const { detectIntent, detectEmotion } = require('./conversation-manager');
const { createConversationState, summarizeConversationState } = require('./conversation-memory');

function createPlannerSupervisor({ toolDispatcher, log = console, eventBus = null } = {}) {
  /**
   * Plan the next conversation move.
   * SAFE DEFAULT: tools only when intent is explicit AND autoTools enabled.
   * Live calls primarily rely on AI emit codes ([SEND_DEMO_SMS] etc.).
   */
  function planTurn({ transcript = '', manager = null, lead = {}, meta = {} } = {}) {
    const text = String(transcript || '');
    const intent = detectIntent(text) || meta.intent || 'DISCOVERY';
    const emotion = detectEmotion(text) || meta.emotion || 'neutral';
    const conversationState = manager?.summarize
      ? manager.summarize().memory
      : summarizeConversationState(createConversationState(meta.memory || {}));
    let nextState = 'DISCOVERY';
    let toolPlan = [];
    let responseMode = 'conversation';
    // Auto side-effects off unless PLANNER_AUTO_TOOLS=true or meta.autoTools
    const autoTools =
      meta.autoTools === true ||
      String(process.env.PLANNER_AUTO_TOOLS || '').toLowerCase() === 'true';

    switch (intent) {
      case 'ASKED_PRICING':
        nextState = 'QUALIFICATION';
        // Pricing SMS only when auto-tools on — otherwise AI can emit [SEND_PRICING]
        if (autoTools) {
          toolPlan = [
            {
              tool: 'send_sms',
              args: { template: 'pricing', phone: lead?.phone || lead?.targetPhoneNumber }
            }
          ];
        }
        responseMode = 'pricing_reply';
        break;
      case 'ASKED_PAYMENT':
        nextState = 'PAYMENT';
        if (autoTools) toolPlan = [{ tool: 'create_invoice', args: {} }];
        responseMode = 'payment_reply';
        break;
      case 'ASKED_DEMO':
        nextState = 'DEMO';
        if (autoTools) {
          toolPlan = [
            {
              tool: 'send_sms',
              args: { template: 'demo', phone: lead?.phone || lead?.targetPhoneNumber }
            }
          ];
        }
        responseMode = 'demo_reply';
        break;
      case 'ASKED_WEBSITE':
        nextState = 'DISCOVERY';
        responseMode = 'website_reply';
        break;
      case 'OBJECTION_RAISED':
        nextState = 'OBJECTION';
        responseMode = 'objection_reply';
        break;
      case 'REJECTED':
        nextState = 'END';
        // Mark DNC via action runner path when auto tools on
        if (autoTools) {
          toolPlan = [{ tool: 'update_crm', args: { reason: 'rejected' } }];
        }
        responseMode = 'closing_reply';
        break;
      case 'BOUGHT':
        nextState = 'PAYMENT';
        if (autoTools) toolPlan = [{ tool: 'create_invoice', args: {} }];
        responseMode = 'close_reply';
        break;
      default:
        nextState = conversationState?.stage || 'DISCOVERY';
        responseMode = 'discovery_reply';
        // NO tools on default — previously auto-fired demo SMS + hot lead
        break;
    }

    const plan = {
      intent,
      emotion,
      nextState,
      responseMode,
      toolPlan,
      conversationState,
      leadScore: conversationState?.leadScore || 0,
      shouldUseLLM: true,
      shouldDispatchTools: autoTools && Array.isArray(toolPlan) && toolPlan.length > 0
    };

    log.info?.(`[PLANNER] intent=${intent} state=${nextState} emotion=${emotion}`);
    eventBus?.emit('INTENT_CHANGED', {
      callSid: meta.callSid || lead?.callSid || 'system',
      intent,
      emotion,
      nextState,
      responseMode,
      leadScore: plan.leadScore,
      toolPlan
    });
    return plan;
  }

  async function execute({ transcript = '', manager = null, lead = {}, meta = {} } = {}) {
    const plan = planTurn({ transcript, manager, lead, meta });
    if (toolDispatcher && plan.shouldDispatchTools) {
      eventBus?.emit('TOOL_REQUESTED', {
        callSid: meta.callSid || lead?.callSid || 'system',
        intent: plan.intent,
        nextState: plan.nextState,
        toolPlan: plan.toolPlan,
        lead
      });
      const toolResults = await toolDispatcher.dispatch(plan.toolPlan, lead, meta);
      eventBus?.emit('TOOL_COMPLETED', {
        callSid: meta.callSid || lead?.callSid || 'system',
        intent: plan.intent,
        nextState: plan.nextState,
        toolResults
      });
      return { plan, toolResults };
    }
    return { plan };
  }

  return {
    planTurn,
    execute
  };
}

module.exports = {
  createPlannerSupervisor
};
