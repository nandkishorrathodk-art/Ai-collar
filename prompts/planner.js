/**
 * PROMPT MODULE 9: CONVERSATION PLANNER & DYNAMIC FSM ENGINE (UPGRADED)
 * Enterprise-grade state transitions representing a non-linear graph.
 * Handles: exitConditions, bestActions, risks, and fallback strategies dynamically.
 */

const FSM_GRAPH = {
  greeting: {
    next: ['discovery', 'objection', 'goodbye'],
    goal: 'Warmly introduce yourself and ask how their front desk currently handles call overflow when staff is busy',
    exitCondition: 'Caller acknowledges role or answers initial workflow question',
    fallback: 'Ask: "What happens right now when someone calls while your staff is with a client?"'
  },
  discovery: {
    next: ['pricing', 'demo_pitch', 'objection', 'goodbye'],
    goal: 'Probe deeply into their exact call workflow and estimate missed call revenue impact BEFORE pitching solutions',
    exitCondition: 'Caller shares their missed call volume or front desk pain point',
    fallback: 'Ask: "How many calls would you guess go to voicemail on a busy day?"'
  },
  pricing: {
    next: ['closing', 'objection', 'goodbye'],
    goal: 'Deliver package pricing ($499 setup + $297/mo) tied directly to their specific clinic numbers with instant ROI',
    exitCondition: 'Caller understands price and calculated ROI ratio',
    fallback: 'Show how capturing just 1 single patient/client covers an entire year of service'
  },
  demo_pitch: {
    next: ['closing', 'objection', 'goodbye'],
    goal: 'Pitch a live 5-minute interactive demo booking for tomorrow',
    exitCondition: 'Caller agrees to demo time slot or provides phone number',
    fallback: 'Offer to text a 15-second instant interactive audio preview to their cell right now'
  },
  objection: {
    next: ['discovery', 'pricing', 'demo_pitch', 'closing', 'goodbye'],
    goal: 'Validate concern, share a mini case study / proof point, and pivot directly to demo booking',
    exitCondition: 'Objection resolved with evidence, leading to demo ask',
    fallback: 'Share a real client example in their industry and offer a zero-risk 5-minute live preview'
  },
  closing: {
    next: ['goodbye'],
    goal: 'Lock in a live 5-minute demo appointment on Google Calendar with 2 specific time options ("10 AM or 2 PM tomorrow")',
    exitCondition: 'Time slot confirmed or calendar link sent via text',
    fallback: 'Offer two specific time slots: "How does 10 AM or 3 PM tomorrow sound?"'
  },
  goodbye: {
    next: [],
    goal: 'Confirm demo details, send confirmation SMS, and wrap up warmly',
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
  return `=== 9. CONVERSATION PLANNER (DYNAMIC FSM v5.2) ===
- Current FSM Stage: ${plan.stage.toUpperCase()}
- Active Goal: ${plan.goal}
- Exit Condition: ${plan.exitCondition}
- Fallback Strategy: ${plan.fallback}
- Fatigue Risk Level: ${plan.risk}
- Planner Confidence: ${Math.round(plan.confidence * 100)}%

CORE STRATEGY RULES FOR THIS TURN:
1. DISCOVERY FIRST: Never pitch features in turn 1 or 2. Probe how they handle front desk call overflow first.
2. CUSTOM ROI: Tie ROI numbers directly to the caller's specific industry and reported missed call volume.
3. DEMO BOOKING BIAS: Aim for booking a 5-minute live demo appointment with 2 specific time options. Do not settle for just emailing info.`;
}

module.exports = {
  FSM_GRAPH,
  planNextAction,
  getPlannerContext
};
