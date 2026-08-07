/**
 * PROMPT MODULE 12: PROMPT BUILDER (UPGRADED)
 * Enterprise-grade prompt orchestrator integrating cognitive reasoning prompts, FSM constraints, and XML thought instructions.
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

  const sections = [
    getIdentityContext(),
    getMissionContext(),
    getThinkingContext(intent),
    getIntentContext(intent),
    getEmotionContext(emotion, signals, currentLeadScore),
    memoryEngine.getMemoryContext(),
    getIndustryContext(leadData.industry || 'dental'),
    getObjectionContext(userSpeech),
    getPlannerContext(plan),
    getPersonalityContext(emotion.emotion, plan.stage),
    getRulesContext(),
    getActionsContext()
  ];

  // Cognitive instructions wrapping thinking output format
  const cognitiveHeader = `=== COGNITIVE BRAIN & STRUCTURAL SYSTEM INSTRUCTION ===
IMPORTANT: Before generating every single reply, you MUST perform a deep logical analysis of the caller and your goal.
You MUST write your thoughts wrapped inside a <thinking>...</thinking> XML block.
Example format of your response:
<thinking>
Thought: Caller is skeptical about price.
Goal: Reframe value using dentist ROI.
Action: Output [ACTION:SEND_DEMO_SMS] if agreed.
Stage: discovery
</thinking>
Got it! Our AI saves dental offices over 30 hours of front desk work...

Ensure the thinking thoughts are concise. Ensure the final reply itself is under 30 words and directly answers the user. Do not read the thinking thoughts aloud.`;

  return `${cognitiveHeader}\n\n${sections.join('\n\n')}`;
}

module.exports = {
  buildPrompt
};
