/**
 * PROMPT MODULE 9: CONVERSATION PLANNER & DYNAMIC FSM ENGINE (UPGRADED)
 * Enterprise-grade state transitions representing a non-linear graph.
 * Handles: exitConditions, bestActions, risks, and fallback strategies dynamically.
 */

const FSM_GRAPH = {
  greeting: {
    next: ['discovery', 'objection', 'goodbye'],
    goal: 'Introduce role and hook business owner with missed-call pain point',
    exitCondition: 'Caller confirms identity or expresses interest',
    fallback: 'If busy, offer instant SMS demo text'
  },
  discovery: {
    next: ['pricing', 'demo_pitch', 'objection', 'goodbye'],
    goal: 'Identify if caller loses leads to voicemail during service hours',
    exitCondition: 'Caller admits they miss calls or are curious about setup',
    fallback: 'Explain how 35% of industry calls go unanswered'
  },
  pricing: {
    next: ['closing', 'objection', 'goodbye'],
    goal: 'Deliver package pricing ($499 setup + $297/mo) with ROI reframing',
    exitCondition: 'Caller understands cost and value ratio',
    fallback: 'Ask if saving 1 call per month covers $297'
  },
  demo_pitch: {
    next: ['closing', 'objection', 'goodbye'],
    goal: 'Get permission to send instant SMS preview link to cell phone',
    exitCondition: 'Caller provides cell phone or confirms text destination',
    fallback: 'Ask if they want to test the voice receptionist themselves'
  },
  objection: {
    next: ['discovery', 'pricing', 'demo_pitch', 'closing', 'goodbye'],
    goal: 'Reframe hesitation (cost, voicemail, partner) to value points',
    exitCondition: 'Objection resolved, returning to sales loop',
    fallback: 'Gently pivot to sending a 1-page summary text'
  },
  closing: {
    next: ['goodbye'],
    goal: 'Secure appointment booking in Google Calendar or process setup checkout',
    exitCondition: 'Slot booked, checkout link sent, or transfer completed',
    fallback: 'Confirm best callback time and lock calendar schedule'
  },
  goodbye: {
    next: [],
    goal: 'Polite close and call hangup action',
    exitCondition: 'Call completed',
    fallback: 'Direct hangup'
  }
};

function planNextAction({ currentStage = 'greeting', intent = 'QUESTION', emotion = 'NEUTRAL', turnCount = 0 } = {}) {
  let stage = String(currentStage).toLowerCase();
  if (!FSM_GRAPH[stage]) stage = 'greeting';

  // State transitions based on intent
  let nextStage = stage;
  if (intent === 'GREETING' && stage === 'greeting') {
    nextStage = 'discovery';
  } else if (intent === 'PRICING') {
    nextStage = 'pricing';
  } else if (intent === 'OBJECTION') {
    nextStage = 'objection';
  } else if (intent === 'BOOKING') {
    nextStage = 'closing';
  } else if (intent === 'SMS_REQUEST') {
    nextStage = 'demo_pitch';
  } else if (intent === 'GOODBYE') {
    nextStage = 'goodbye';
  }

  const fsm = FSM_GRAPH[nextStage] || FSM_GRAPH.greeting;
  const risk = turnCount > 5 ? 'High (Caller fatigue)' : 'Low';
  
  return {
    stage: nextStage,
    goal: fsm.goal,
    exitCondition: fsm.exitCondition,
    fallback: fsm.fallback,
    risk,
    confidence: emotion === 'ANGRY' ? 0.4 : 0.85
  };
}

function getPlannerContext(plan) {
  return `=== 9. CONVERSATION PLANNER (DYNAMIC FSM) ===
- Current FSM Stage: ${plan.stage.toUpperCase()}
- Active Goal: ${plan.goal}
- Exit Condition: ${plan.exitCondition}
- Fallback Strategy: ${plan.fallback}
- Fatigue Risk Level: ${plan.risk}
- Planner Confidence: ${Math.round(plan.confidence * 100)}%`;
}

module.exports = {
  FSM_GRAPH,
  planNextAction,
  getPlannerContext
};
