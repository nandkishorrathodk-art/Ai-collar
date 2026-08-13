/**
 * PROMPT SYSTEM v5 MASTER INDEX (UPGRADED)
 * Exports all modular prompt sub-engines & unified builder.
 */

const { IDENTITY, getIdentityContext } = require('./identity');
const { MISSION, getMissionContext } = require('./mission');
const { THINKING_LEVELS, chooseThinking, getThinkingContext } = require('./thinking');
const { INTENTS, detectIntent, getIntentContext } = require('./intent');
const { EMOTIONS, detectEmotion, analyzeBuyingSignals, getEmotionContext } = require('./emotion');
const { MemoryEngine } = require('./memory');
const { INDUSTRIES, getIndustryInfo, getIndustryContext } = require('./industry');
const { OBJECTIONS, getObjectionStrategy, getMultiTurnObjectionStrategy, clearCallObjections, getObjectionContext } = require('./objection');
const { planNextAction, getPlannerContext } = require('./planner');
const { RULES, getRulesContext } = require('./rules');
const { ACTION_TAGS, getActionsContext } = require('./actions');
const { getPersonalityContext } = require('./personality');
const { sanitizeForHumanSpeech, getVocalHumanizerContext, getContextualOpener, pickRandom } = require('./vocal-humanizer');
const { buildPrompt, buildPromptFull, calculateDynamicTemperature, getCompetitorAwarenessContext } = require('./builder');
const { recordCallOutcome, getLearningContext, getRankedHooks, getRankedObjectionStrategies, getLearningSummary } = require('./self-learning');

module.exports = {
  IDENTITY,
  MISSION,
  THINKING_LEVELS,
  INTENTS,
  EMOTIONS,
  MemoryEngine,
  INDUSTRIES,
  OBJECTIONS,
  RULES,
  ACTION_TAGS,
  
  // Logic Methods
  chooseThinking,
  detectIntent,
  detectEmotion,
  analyzeBuyingSignals,
  getIndustryInfo,
  getObjectionStrategy,
  getMultiTurnObjectionStrategy,
  clearCallObjections,
  getObjectionContext,
  planNextAction,
  getPersonalityContext,
  sanitizeForHumanSpeech,
  getVocalHumanizerContext,
  getContextualOpener,
  pickRandom,
  
  // Self-Learning
  recordCallOutcome,
  getLearningContext,
  getRankedHooks,
  getRankedObjectionStrategies,
  getLearningSummary,
  
  // Prompt Generator
  buildPrompt,
  buildPromptFull,
  calculateDynamicTemperature,
  getCompetitorAwarenessContext
};
