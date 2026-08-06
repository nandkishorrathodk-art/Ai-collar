/**
 * Production-safe conversation memory scaffolding.
 * This is a low-friction state layer that can later feed
 * realtime memory + CRM + analytics pipelines.
 */

const DEFAULT_CONVERSATION_STATE = {
  name: '',
  ownerName: '',
  interestLevel: 'unknown',
  stage: 'intro',
  emotion: 'neutral',
  objections: [],
  questionsAsked: [],
  intent: 'intro',
  leadScore: 0,
  history: [],
  toolsExecuted: [],
  pendingActions: [],
  summary: '',
  smsSent: false,
  paymentSent: false,
  dealProbability: 0,
  callDuration: 0,
  lastIntent: 'intro',
  lastAction: null,
  doNotCall: false
};

function createConversationState(seed = {}) {
  const normalizedSeed = {
    ...DEFAULT_CONVERSATION_STATE,
    ...seed,
    objections: Array.isArray(seed.objections) ? [...seed.objections] : [],
    questionsAsked: Array.isArray(seed.questionsAsked) ? [...seed.questionsAsked] : [],
    history: Array.isArray(seed.history) ? [...seed.history] : [],
    toolsExecuted: Array.isArray(seed.toolsExecuted) ? [...seed.toolsExecuted] : [],
    pendingActions: Array.isArray(seed.pendingActions) ? [...seed.pendingActions] : []
  };
  if (!normalizedSeed.summary) {
    normalizedSeed.summary = buildCallSummary(normalizedSeed);
  }
  return normalizedSeed;
}

function mergeConversationState(existing = {}, updates = {}) {
  const state = createConversationState(existing);
  if (updates.objections) {
    state.objections = [...new Set([...state.objections, ...updates.objections])];
  }
  if (updates.questionsAsked) {
    state.questionsAsked = [...new Set([...state.questionsAsked, ...updates.questionsAsked])];
  }
  if (updates.history) {
    state.history = [...state.history, ...updates.history];
  }
  if (updates.toolsExecuted) {
    state.toolsExecuted = [...state.toolsExecuted, ...updates.toolsExecuted];
  }
  if (updates.pendingActions) {
    state.pendingActions = [...state.pendingActions, ...updates.pendingActions];
  }
  const merged = {
    ...state,
    ...updates,
    objections: state.objections,
    questionsAsked: state.questionsAsked,
    history: state.history,
    toolsExecuted: state.toolsExecuted,
    pendingActions: state.pendingActions,
    dealProbability: Number(updates.dealProbability ?? state.dealProbability ?? 0),
    callDuration: Number(updates.callDuration ?? state.callDuration ?? 0),
    leadScore: Number(updates.leadScore ?? computeLeadScore(state))
  };
  merged.intent = updates.intent || merged.lastIntent || merged.intent || 'intro';
  merged.stage = updates.stage || merged.stage || 'intro';
  merged.summary = buildCallSummary(merged);
  return merged;
}

function recordObjection(state, objection) {
  if (!objection) return state;
  return mergeConversationState(state, {
    objections: [String(objection)],
    lastIntent: 'objection',
    emotion: 'confused'
  });
}

function recordQuestion(state, question) {
  if (!question) return state;
  return mergeConversationState(state, {
    questionsAsked: [String(question)],
    lastIntent: 'discovery'
  });
}

function buildCallSummary(state = {}) {
  const objections = Array.isArray(state.objections) ? state.objections : [];
  const questionsAsked = Array.isArray(state.questionsAsked) ? state.questionsAsked : [];
  const history = Array.isArray(state.history) ? state.history : [];
  const tools = Array.isArray(state.toolsExecuted) ? state.toolsExecuted : [];
  const pending = Array.isArray(state.pendingActions) ? state.pendingActions : [];
  return [
    `Stage: ${state.stage || 'intro'}`,
    `Intent: ${state.intent || state.lastIntent || 'intro'}`,
    `Emotion: ${state.emotion || 'neutral'}`,
    `Interest: ${state.interestLevel || 'unknown'}`,
    `Lead Score: ${state.leadScore || computeLeadScore(state)}`,
    `Objections: ${objections.length ? objections.join(', ') : 'none'}`,
    `Questions Asked: ${questionsAsked.length ? questionsAsked.join(', ') : 'none'}`,
    `History Turns: ${history.length}`,
    `Tools Executed: ${tools.length ? tools.join(', ') : 'none'}`,
    `Pending Actions: ${pending.length ? pending.join(', ') : 'none'}`
  ].join(' | ');
}

function appendHistory(state = {}, entry = {}) {
  const next = createConversationState(state);
  next.history = [...next.history, { ...entry, at: entry.at || new Date().toISOString() }];
  next.summary = buildCallSummary(next);
  return next;
}

function registerToolExecution(state = {}, toolName, result = {}) {
  const next = createConversationState(state);
  next.toolsExecuted = [...next.toolsExecuted, String(toolName || 'unknown')];
  next.pendingActions = next.pendingActions.filter((item) => item !== toolName);
  next.summary = buildCallSummary(next);
  return { ...next, lastToolResult: result };
}

function computeLeadScore(state = {}) {
  const scoreMap = {
    hot: 90,
    warm: 70,
    neutral: 50,
    cold: 25,
    unknown: 0
  };
  const base = scoreMap[state.interestLevel] ?? 0;
  const objectionPenalty = Math.max(0, state.objections?.length || 0) * 3;
  const questionBonus = Math.min(10, (state.questionsAsked?.length || 0) * 2);
  return Math.max(0, Math.min(100, base + questionBonus - objectionPenalty));
}

function summarizeConversationState(state = {}) {
  const normalized = createConversationState(state);
  return {
    stage: normalized.stage || 'intro',
    emotion: normalized.emotion || 'neutral',
    objections: Array.isArray(normalized.objections) ? normalized.objections : [],
    intent: normalized.intent || normalized.lastIntent || 'intro',
    leadScore: Number(normalized.leadScore || computeLeadScore(normalized)),
    history: Array.isArray(normalized.history) ? normalized.history : [],
    toolsExecuted: Array.isArray(normalized.toolsExecuted) ? normalized.toolsExecuted : [],
    pendingActions: Array.isArray(normalized.pendingActions) ? normalized.pendingActions : [],
    summary: normalized.summary || buildCallSummary(normalized),
    ownerKnown: Boolean(normalized.ownerName),
    interestLevel: normalized.interestLevel || 'unknown',
    questionsAsked: Array.isArray(normalized.questionsAsked) ? normalized.questionsAsked : []
  };
}

module.exports = {
  DEFAULT_CONVERSATION_STATE,
  createConversationState,
  mergeConversationState,
  recordObjection,
  recordQuestion,
  appendHistory,
  registerToolExecution,
  computeLeadScore,
  summarizeConversationState,
  buildCallSummary
};
