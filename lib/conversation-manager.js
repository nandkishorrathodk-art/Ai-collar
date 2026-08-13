/**
 * Conversation Core v1
 * - ConversationManager class
 * - Finite State Machine (FSM)
 * - Persistent conversation memory snapshot
 * - Intent detection
 * - Emotion tracking
 * - Lead scoring
 * - Action queue
 */

const {
  createConversationState,
  mergeConversationState,
  summarizeConversationState,
  computeLeadScore,
  recordObjection,
  recordQuestion
} = require('./conversation-memory');

const STATE_SEQUENCE = [
  'START',
  'GREETING',
  'DISCOVERY',
  'QUALIFICATION',
  'VALUE',
  'OBJECTION',
  'DEMO',
  'PAYMENT',
  'ONBOARDING',
  'FOLLOWUP',
  'END'
];

const EVENT_TO_STATE = {
  ASKED_PRICING: 'QUALIFICATION',
  ASKED_WEBSITE: 'DISCOVERY',
  ASKED_DEMO: 'DEMO',
  ASKED_PAYMENT: 'PAYMENT',
  ASKED_BUDGET: 'QUALIFICATION',
  OBJECTION_RAISED: 'OBJECTION',
  REJECTED: 'END',
  BOUGHT: 'PAYMENT',
  ONBOARDED: 'ONBOARDING',
  FOLLOWUP_SENT: 'FOLLOWUP',
  GREETED: 'GREETING',
  STARTED: 'START'
};

// Order matters: more specific / high-stakes intents first.
// NEVER match bare "yes" as BOUGHT — that fires on "yes I'm the owner".
const INTENT_KEYWORDS = {
  REJECTED: [
    /no thanks?\b/i,
    /not interested/i,
    /remove me/i,
    /do not call/i,
    /don't call/i,
    /stop calling/i,
    /take me off/i,
    /\bstop\b.*\b(call|text|contact)/i
  ],
  BOUGHT: [
    /\b(let'?s do it|sign me up|i'?ll take it|i want (it|the package)|ready to (buy|pay|start)|send (me )?(the )?(invoice|payment|checkout))\b/i,
    /\b(deal|i'?m in|we'?re in)\b/i
  ],
  ASKED_PAYMENT: [
    /\b(pay|payment|checkout|invoice|credit card|how do i pay)\b/i
  ],
  ASKED_PRICING: [
    /\b(price|pricing|cost|how much|monthly|quote|rate|what does it cost)\b/i
  ],
  ASKED_DEMO: [
    /\b(demo|show me|preview|example|portfolio|send (me )?(a )?link|text (me )?(the )?link)\b/i
  ],
  ASKED_WEBSITE: [/\b(website|web site|landing page|do you (build|make) sites?)\b/i],
  OBJECTION_RAISED: [
    /too expensive/i,
    /can'?t afford/i,
    /\bbusy\b/i,
    /\bscam\b/i,
    /call (me )?later/i,
    /already have (an? )?(ai|receptionist|system)/i,
    /no thank/i
  ],
  FOLLOWUP_SENT: [/follow[\s-]?up/i, /text me/i, /send it/i]
};

const EMOTION_KEYWORDS = {
  angry: [/angry/i, /mad\b/i, /frustrated/i, /\bhate\b/i, /annoyed/i, /pissed/i],
  busy: [/busy/i, /in a meeting/i, /driving/i, /can'?t talk/i, /call later/i, /right now isn'?t/i],
  confused: [/\bconfused\b/i, /\bunclear\b/i, /don'?t understand/i, /what do you mean/i, /\bhuh\??$/i],
  excited: [/awesome/i, /sounds (great|good|amazing)/i, /let'?s do it/i, /\bgreat\b/i, /love (it|that)/i],
  interested: [/interested/i, /tell me more/i, /how does (it|that) work/i, /sounds interesting/i],
  happy: [/thanks/i, /thank you/i, /appreciate/i, /perfect/i]
};

function detectIntent(text = '') {
  const str = String(text || '').trim();
  if (!str) return 'DISCOVERY';
  for (const [intent, patterns] of Object.entries(INTENT_KEYWORDS)) {
    for (const pattern of patterns) {
      if (pattern.test(str)) return intent;
    }
  }
  return 'DISCOVERY';
}

function detectEmotion(text = '') {
  const str = String(text || '').trim();
  if (!str) return 'neutral';
  for (const [emotion, patterns] of Object.entries(EMOTION_KEYWORDS)) {
    for (const pattern of patterns) {
      if (pattern.test(str)) return emotion;
    }
  }
  return 'neutral';
}

function normalizeAction(action) {
  return String(action || '').trim().toUpperCase();
}

class ConversationManager {
  constructor({ callSid = 'unknown', seed = {} } = {}) {
    this.callSid = callSid;
    this.currentState = 'START';
    this.intentHistory = [];
    this.actionQueue = [];
    this.memory = createConversationState(seed);
    this.lastTurnAt = new Date().toISOString();

    // Auto-restore state from store if callSid exists (Fix Bug #17)
    if (callSid && callSid !== 'unknown') {
      try {
        const store = require('./store');
        const existing = store.getConversation(callSid);
        if (existing) {
          this.currentState = existing.stage || existing.currentState || 'START';
          if (Array.isArray(existing.history)) {
            this.intentHistory = existing.history.map(h => h.role || h.intent || h);
          }
          if (existing.memory) {
            this.memory = createConversationState(existing.memory);
          }
        }
      } catch { /* ignore store load error in constructor */ }
    }
  }

  transition(eventName, payload = {}) {
    const next = EVENT_TO_STATE[eventName] || this.currentState;
    this.currentState = next;
    this.intentHistory.push(eventName);
    this.lastTurnAt = new Date().toISOString();

    if (payload?.question) {
      this.memory = recordQuestion(this.memory, payload.question);
    }
    if (payload?.objection) {
      this.memory = recordObjection(this.memory, payload.objection);
    }
    if (payload?.interestLevel) {
      this.memory = mergeConversationState(this.memory, { interestLevel: payload.interestLevel });
    }
    if (payload?.emotion) {
      this.memory = mergeConversationState(this.memory, { emotion: payload.emotion });
    }
    if (payload?.ownerName) {
      this.memory = mergeConversationState(this.memory, { ownerName: payload.ownerName });
    }
    if (payload?.name) {
      this.memory = mergeConversationState(this.memory, { name: payload.name });
    }

    const calculatedScore = payload?.leadScore ?? computeLeadScore(this.memory);

    this.memory = mergeConversationState(this.memory, {
      lastIntent: eventName,
      stage: this.currentState,
      leadScore: calculatedScore
    });

    return this.currentState;
  }

  queueAction(action) {
    const normalized = normalizeAction(action);
    if (!normalized) return false;
    this.actionQueue.push(normalized);
    return normalized;
  }

  dequeueAction() {
    return this.actionQueue.shift() || null;
  }

  processTurn(text = '', meta = {}) {
    const intent = detectIntent(text);
    const emotion = detectEmotion(text);
    const normalizedIntent = typeof meta.intent === 'string' ? meta.intent : intent;
    const normalizedEmotion = typeof meta.emotion === 'string' ? meta.emotion : emotion;

    this.memory = mergeConversationState(this.memory, {
      emotion: normalizedEmotion,
      interestLevel: meta.interestLevel || this.memory.interestLevel || 'unknown',
      lastIntent: normalizedIntent,
      callDuration: Number(meta.callDuration ?? this.memory.callDuration ?? 0)
    });

    if (meta.question) {
      this.memory = recordQuestion(this.memory, meta.question);
    }
    if (meta.objection) {
      this.memory = recordObjection(this.memory, meta.objection);
    }

    // Fix Bug #5: Calculate lead score once per turn
    const score = computeLeadScore(this.memory);
    this.memory = mergeConversationState(this.memory, { leadScore: score });

    this.transition(normalizedIntent, {
      question: meta.question,
      objection: meta.objection,
      ownerName: meta.ownerName,
      name: meta.name,
      emotion: normalizedEmotion,
      interestLevel: meta.interestLevel,
      leadScore: score
    });

    if (meta.action) this.queueAction(meta.action);
    this.memory = mergeConversationState(this.memory, {
      stage: this.currentState
    });

    return this.summarize();
  }

  scoreLead() {
    const score = computeLeadScore(this.memory);
    this.memory = mergeConversationState(this.memory, { leadScore: score });
    return score;
  }

  summarize() {
    return {
      currentState: this.currentState,
      actionQueue: [...this.actionQueue],
      memory: summarizeConversationState(this.memory),
      intentHistory: [...this.intentHistory]
    };
  }

  toJSON() {
    return {
      callSid: this.callSid,
      currentState: this.currentState,
      intentHistory: [...this.intentHistory],
      actionQueue: [...this.actionQueue],
      memory: structuredClone ? structuredClone(this.memory) : JSON.parse(JSON.stringify(this.memory)),
      lastTurnAt: this.lastTurnAt
    };
  }

  static hydrate(payload = {}) {
    const manager = new ConversationManager({
      callSid: payload.callSid || 'unknown',
      seed: payload.memory || {}
    });
    manager.currentState = payload.currentState || 'START';
    manager.intentHistory = Array.isArray(payload.intentHistory) ? [...payload.intentHistory] : [];
    manager.actionQueue = Array.isArray(payload.actionQueue) ? [...payload.actionQueue] : [];
    manager.memory = createConversationState(payload.memory || {});
    manager.lastTurnAt = payload.lastTurnAt || new Date().toISOString();
    return manager;
  }
}

module.exports = {
  ConversationManager,
  STATE_SEQUENCE,
  EVENT_TO_STATE,
  detectIntent,
  detectEmotion,
  normalizeAction
};
