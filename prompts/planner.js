/**
 * PROMPT MODULE 9: PLANNER ENGINE
 * Pre-reply decision loop calculating next best action & output format.
 */

function planNextAction({ stage = 'greeting', intent = 'QUESTION', emotion = 'NEUTRAL' } = {}) {
  let goal = 'Engage Prospect';
  let action = 'ANSWER_AND_ASK';
  let replyStyle = 'Friendly & Concise';

  if (intent === 'BOOKING' || stage === 'pitch_accepted') {
    goal = 'Schedule Google Calendar Appointment';
    action = 'TRIGGER_BOOK_APPOINTMENT';
    replyStyle = 'Direct & Direct Slot Offer';
  } else if (intent === 'SMS_REQUEST') {
    goal = 'Deliver Instant SMS Demo Link';
    action = 'TRIGGER_SEND_DEMO_SMS';
    replyStyle = 'Confirmed & Enthusiastic';
  } else if (intent === 'PRICING') {
    goal = 'Pitch Starter Package Value ($499 + $297/mo)';
    action = 'PITCH_PACKAGE';
    replyStyle = 'Value Focused';
  } else if (intent === 'OBJECTION') {
    goal = 'Overcome Hesitation & Offer Quick Demo';
    action = 'HANDLE_OBJECTION';
    replyStyle = 'Empathetic & Solution Oriented';
  }

  return {
    goal,
    stage,
    action,
    replyStyle
  };
}

function getPlannerContext(plan) {
  return `=== 9. PLANNER ENGINE ===
Goal: ${plan.goal}
Recommended Action: ${plan.action}
Reply Style: ${plan.replyStyle}`;
}

module.exports = {
  planNextAction,
  getPlannerContext
};
