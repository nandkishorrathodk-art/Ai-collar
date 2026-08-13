/**
 * PROMPT MODULE 12: PROMPT BUILDER v2.0 (UPGRADED)
 * Enterprise-grade prompt orchestrator with:
 *   ✓ Self-learning context integration
 *   ✓ Competitor-aware response injection
 *   ✓ Multi-turn memory with conversation flow
 *   ✓ Enhanced cognitive decision framework
 *   ✓ Dynamic temperature adjustment based on conversation stage
 */

const { getIdentityContext } = require('./identity');
const { getMissionContext } = require('./mission');
const { chooseThinking, getThinkingContext } = require('./thinking');
const { detectIntent, getIntentContext } = require('./intent');
const { detectEmotion, analyzeBuyingSignals, getEmotionContext } = require('./emotion');
const { MemoryEngine } = require('./memory');
const { getIndustryContext } = require('./industry');
const { getObjectionContext } = require('./objection');
const { planNextAction, getPlannerContext } = require('./planner');
const { getRulesContext } = require('./rules');
const { getActionsContext } = require('./actions');
const { getPersonalityContext } = require('./personality');
const { getVocalHumanizerContext } = require('./vocal-humanizer');
const { getLearningContext } = require('./self-learning');

function buildPrompt(leadData = {}, userSpeech = '') {
  const memoryEngine = new MemoryEngine(leadData);
  const intent = detectIntent(userSpeech);
  const emotion = detectEmotion(userSpeech);
  const signals = analyzeBuyingSignals(userSpeech);
  
  const currentLeadScore = leadData.leadScore || 0;
  
  // Calculate dynamic FSM planning
  const plan = planNextAction({ 
    currentStage: leadData.stage || 'greeting', 
    intent, 
    emotion: emotion.emotion,
    turnCount: leadData.turnCount || 0
  });

  // Dynamic temperature based on conversation stage and emotion
  const dynamicTemperature = calculateDynamicTemperature(plan.stage, emotion.emotion, leadData.turnCount || 0);

  const sections = [
    getIdentityContext(),
    getMissionContext(),
    getThinkingContext(intent),
    getIntentContext(intent),
    getEmotionContext(emotion, signals, currentLeadScore),
    memoryEngine.getMemoryContext(),
    getIndustryContext(leadData.industry || 'dental'),
    getObjectionContext(userSpeech, leadData.callSid || null),
    getPlannerContext(plan),
    getPersonalityContext(emotion.emotion, plan.stage),
    getVocalHumanizerContext(),
    getLearningContext(leadData.industry || 'general'),
    getCompetitorAwarenessContext(),
    getRulesContext(),
    getActionsContext()
  ];

  // Enhanced Cognitive Decision Framework
  const cognitiveHeader = `=== ADVANCED SALESPERSON v5.2 — HIGH-CONVERTING CONSULTATIVE SALES BRAIN ===
GOLDEN RULE: You do NOT try to sell a product. You act as a warm, knowledgeable business consultant who understands the customer's exact situation, probes their daily workflow, calculates personal ROI, backs claims with proof, and guides them to book a live demo.

5 CORE EXECUTION MANDATES (MUST ENFORCE ON EVERY TURN):
1. SOUND NATURAL & UN-SCRIPTED: Speak with authentic warmth, intelligent curiosity, and zero telemarketer tone. Acknowledge what they said naturally ("Oh gotcha...", "Yeah totally...", "I hear you on that...").
2. DEEP WORKFLOW DISCOVERY BEFORE PITCHING: Never rush to pitch features in turn 1 or 2. Ask probing questions about their current phone setup ("How does your front desk handle calls when staff is busy or after 5 PM?").
3. CLINIC-SPECIFIC CUSTOM ROI: Calculate live ROI tied to their specific numbers (e.g., "If you miss 10 calls a month and even 2 were new patients at $1,200 lifetime value, that's $2,400 walking out the door every month vs $297 for Sarah").
4. PROOF & MINI CASE STUDIES: Answer objections using real mini case studies (e.g., "Dr. Miller in Austin had 2 receptionists and still missed 15 calls/mo. Sarah caught 12 after-hours emergencies in month one, generating $14K in new revenue").
5. CLOSE FOR LIVE DEMO BOOKING: Do NOT settle for sending PDFs or passive follow-ups. Always close for a live 5-minute demo: "Can I show you how it works live for 5 minutes tomorrow — how does 10 AM or 2 PM look?"

CONVERSATION FLOW PHASES:
- Turn 1: WARM HOOK + ASK WORKFLOW — Greet warmly and ask how they currently handle call overflow.
- Turn 2: PROBE PAIN & VOLUME — Ask how many calls go to voicemail and what that costs them.
- Turn 3-4: CALCULATE CUSTOM ROI + PROOF — Connect their numbers to concrete ROI & a client case study.
- Turn 5+: OVERCOME OBJECTIONS + BOOK DEMO — Handle remaining doubts with proof and secure a live demo slot.

DYNAMIC TEMPERATURE: ${dynamicTemperature.toFixed(2)} (${dynamicTemperature < 0.5 ? 'precise/closing' : dynamicTemperature < 0.7 ? 'balanced' : 'creative/rapport'})

Before generating every response, perform a 1-line logical analysis inside a <thinking>...</thinking> block:
<thinking>
Emotion: ${emotion.emotion} | Intent: ${intent} | Need: [what they need] | Stage: ${plan.stage} | Score: ${currentLeadScore + signals.scoreDelta}/100 | Strategy: [your approach] | Action: [emit code or None]
</thinking>
Spoken response text goes here...

Speak naturally as Sarah in 2 to 3 complete, warm, fluent sentences (20 to 35 words). Never output flat telemarketer fragments. Do not read thinking thoughts aloud.`;

  return {
    prompt: `${cognitiveHeader}\n\n${sections.join('\n\n')}`,
    dynamicTemperature,
    emotion: emotion.emotion,
    intent,
    leadScore: Math.min(100, Math.max(0, currentLeadScore + signals.scoreDelta)),
    isClosingSignal: signals.isClosingSignal || false,
    stage: plan.stage
  };
}

/**
 * Calculate dynamic temperature based on conversation context.
 * Lower temp = more precise (closing, objection handling)
 * Higher temp = more creative (discovery, rapport building)
 */
function calculateDynamicTemperature(stage, emotion, turnCount) {
  let temp = 0.7; // Default balanced

  // Stage-based adjustment
  switch (stage) {
    case 'greeting':
    case 'discovery':
      temp = 0.75; // Slightly creative for rapport
      break;
    case 'pitch':
    case 'solution':
      temp = 0.65; // Balanced precision + creativity
      break;
    case 'objection':
      temp = 0.5; // More precise for handling resistance
      break;
    case 'closing':
    case 'close':
      temp = 0.45; // Very precise for closing language
      break;
    case 'followup':
      temp = 0.6;
      break;
  }

  // Emotion-based adjustment
  if (emotion === 'ANGRY' || emotion === 'DEFENSIVE') temp -= 0.1;
  if (emotion === 'BUYING_SIGNAL') temp -= 0.15;
  if (emotion === 'CURIOUS') temp += 0.05;

  // Late conversation = more precise
  if (turnCount > 6) temp -= 0.1;

  return Math.min(0.9, Math.max(0.3, temp));
}

/**
 * Competitor awareness context.
 * General competitive positioning without naming specific competitors.
 */
function getCompetitorAwarenessContext() {
  return `=== 16. COMPETITIVE POSITIONING ===
When prospects mention competitors or alternatives:
1. NEVER badmouth competitors — stay professional and confident.
2. DIFFERENTIATE on these key advantages:
   - Real-time sales intelligence (most competitors just answer calls — Sarah SELLS)
   - Industry-specific knowledge (tailored pitches per vertical, not generic scripts)
   - Self-learning system (improves with every call — gets smarter over time)
   - Hybrid AI engine (multiple voice providers for 99.9% uptime)
   - Sub-second response time (sentence-level streaming, not batch processing)
3. If they mention a specific competitor, say: "I'm familiar with them — they're a solid option. What sets us apart is [specific differentiator for their industry]."
4. Frame as addition, not replacement: "Many clients use us alongside their existing tools and see immediate improvement."`;
}

// Backward compatibility: if old code calls buildPrompt expecting a string
const originalBuildPrompt = buildPrompt;
function buildPromptCompat(leadData = {}, userSpeech = '') {
  const result = originalBuildPrompt(leadData, userSpeech);
  // If caller expects a string (old code), return just the prompt
  if (typeof result === 'object') {
    // Attach metadata to the string for new code to extract
    const promptStr = result.prompt;
    promptStr._meta = result;
    return promptStr;
  }
  return result;
}

module.exports = {
  buildPrompt: buildPromptCompat,
  buildPromptFull: buildPrompt,
  calculateDynamicTemperature,
  getCompetitorAwarenessContext
};
