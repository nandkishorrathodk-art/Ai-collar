/**
 * PROMPT MODULE 12: PROMPT BUILDER
 * Master orchestrator synthesizing Identity, Mission, Thinking, Intent, Emotion, Memory, Industry, Objection, Planner, Rules & Actions.
 */

const { getIdentityContext } = require('./identity');
const { getMissionContext } = require('./mission');
const { chooseThinking, getThinkingContext } = require('./thinking');
const { detectIntent, getIntentContext } = require('./intent');
const { detectEmotion, getEmotionContext } = require('./emotion');
const { MemoryEngine } = require('./memory');
const { getIndustryContext } = require('./industry');
const { getObjectionContext } = require('./objection');
const { planNextAction, getPlannerContext } = require('./planner');
const { getRulesContext } = require('./rules');
const { getActionsContext } = require('./actions');

function buildPrompt(leadData = {}, userSpeech = '') {
  const memoryEngine = new MemoryEngine(leadData);
  const intent = detectIntent(userSpeech);
  const emotion = detectEmotion(userSpeech);
  const plan = planNextAction({ stage: leadData.stage, intent, emotion: emotion.emotion });

  const sections = [
    getIdentityContext(),
    getMissionContext(),
    getThinkingContext(intent),
    getIntentContext(intent),
    getEmotionContext(emotion),
    memoryEngine.getMemoryContext(),
    getIndustryContext(leadData.industry || 'dental'),
    getObjectionContext(userSpeech),
    getPlannerContext(plan),
    getRulesContext(),
    getActionsContext()
  ];

  return sections.join('\n\n');
}

module.exports = {
  buildPrompt
};
