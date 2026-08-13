/**
 * PROMPT MODULE 15: SELF-LEARNING ENGINE
 * Tracks call outcomes, analyzes which pitches/responses work best,
 * and auto-adjusts the AI's approach based on real performance data.
 *
 * Learning loops:
 *   1. Opening hook effectiveness — which hooks get engagement vs hangups
 *   2. Objection response ranking — which responses lead to continuation
 *   3. Discovery question ordering — most effective questions asked first
 *   4. Industry-specific success patterns — what works per vertical
 *   5. Closing timing signals — when to close vs when to keep building
 */

const fs = require('fs');
const path = require('path');

const LEARNING_DB_PATH = path.join(__dirname, '..', 'data', 'learning-db.json');
const MIN_SAMPLES_FOR_LEARNING = 3;
const LEARNING_DECAY_FACTOR = 0.95; // Older data decays slowly

// ── Default learning structure ──────────────────────────────────────────
function createDefaultLearningDB() {
  return {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    totalCalls: 0,
    outcomes: {
      converted: 0,
      callback_scheduled: 0,
      demo_sent: 0,
      objection_stuck: 0,
      hangup: 0,
      no_answer: 0
    },
    hooks: {
      // Track which opening hooks get engagement
      // key: hook_id, value: { used: N, engaged: N, hangup: N, score: 0-100 }
    },
    objectionResponses: {
      // Track which objection responses work
      // key: objection_type, value: { attempts: N, continued: N, converted: N, score: 0-100 }
    },
    discoveryQuestions: {
      // Track which questions reveal most useful info
      // key: question_id, value: { asked: N, useful_response: N, led_to_engagement: N, score: 0-100 }
    },
    industryPatterns: {
      // key: industry, value: { calls: N, conversions: N, avg_duration: N, best_hook: '', best_objection_strategy: '' }
    },
    closingSignals: {
      // key: signal_phrase, value: { detected: N, led_to_close: N, score: 0-100 }
    },
    sessionInsights: []  // Last 50 call summaries for trend analysis
  };
}

// ── Persistence Layer ───────────────────────────────────────────────────
function loadLearningDB() {
  try {
    if (fs.existsSync(LEARNING_DB_PATH)) {
      const raw = fs.readFileSync(LEARNING_DB_PATH, 'utf8');
      const data = JSON.parse(raw);
      // Merge with defaults to handle schema upgrades
      return { ...createDefaultLearningDB(), ...data };
    }
  } catch (err) {
    console.warn('[SELF-LEARNING] Failed to load learning DB, using defaults:', err.message);
  }
  return createDefaultLearningDB();
}

function saveLearningDB(db) {
  try {
    const dir = path.dirname(LEARNING_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db.lastUpdated = new Date().toISOString();
    fs.writeFileSync(LEARNING_DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.warn('[SELF-LEARNING] Failed to save learning DB:', err.message);
  }
}

// ── Learning Data Recording ─────────────────────────────────────────────

/**
 * Record a call outcome for learning purposes.
 * Called when a call ends (from call-status webhook or session cleanup).
 */
function recordCallOutcome({
  callSid,
  outcome = 'hangup',        // converted | callback_scheduled | demo_sent | objection_stuck | hangup | no_answer
  industry = 'general',
  durationSeconds = 0,
  turnCount = 0,
  hookUsed = '',
  objectionsEncountered = [],  // [{ type: 'price', responseUsed: '', continued: true }]
  questionsAsked = [],         // [{ question: '', gotUsefulResponse: true }]
  closingSignalsDetected = [], // ['how fast', 'send contract']
  leadScore = 0
} = {}) {
  const db = loadLearningDB();
  db.totalCalls++;

  // 1. Record outcome
  if (db.outcomes[outcome] !== undefined) {
    db.outcomes[outcome]++;
  }

  // 2. Track hook effectiveness
  if (hookUsed) {
    if (!db.hooks[hookUsed]) {
      db.hooks[hookUsed] = { used: 0, engaged: 0, hangup: 0, score: 50 };
    }
    db.hooks[hookUsed].used++;
    if (outcome === 'hangup' && turnCount <= 2) {
      db.hooks[hookUsed].hangup++;
    } else if (turnCount > 2) {
      db.hooks[hookUsed].engaged++;
    }
    // Recalculate hook score
    const h = db.hooks[hookUsed];
    if (h.used >= MIN_SAMPLES_FOR_LEARNING) {
      h.score = Math.round((h.engaged / h.used) * 100);
    }
  }

  // 3. Track objection response effectiveness
  for (const obj of objectionsEncountered) {
    const key = obj.type || 'unknown';
    if (!db.objectionResponses[key]) {
      db.objectionResponses[key] = { attempts: 0, continued: 0, converted: 0, score: 50 };
    }
    db.objectionResponses[key].attempts++;
    if (obj.continued) db.objectionResponses[key].continued++;
    if (outcome === 'converted') db.objectionResponses[key].converted++;
    // Recalculate score
    const o = db.objectionResponses[key];
    if (o.attempts >= MIN_SAMPLES_FOR_LEARNING) {
      o.score = Math.round(((o.continued + o.converted * 2) / (o.attempts * 2)) * 100);
    }
  }

  // 4. Track discovery question effectiveness
  for (const q of questionsAsked) {
    const key = (q.question || '').slice(0, 60).toLowerCase().replace(/\s+/g, '_');
    if (!key) continue;
    if (!db.discoveryQuestions[key]) {
      db.discoveryQuestions[key] = { asked: 0, useful_response: 0, led_to_engagement: 0, score: 50 };
    }
    db.discoveryQuestions[key].asked++;
    if (q.gotUsefulResponse) db.discoveryQuestions[key].useful_response++;
    if (outcome !== 'hangup') db.discoveryQuestions[key].led_to_engagement++;
    const dq = db.discoveryQuestions[key];
    if (dq.asked >= MIN_SAMPLES_FOR_LEARNING) {
      dq.score = Math.round((dq.useful_response / dq.asked) * 100);
    }
  }

  // 5. Track industry patterns
  if (!db.industryPatterns[industry]) {
    db.industryPatterns[industry] = {
      calls: 0, conversions: 0, avg_duration: 0,
      best_hook: '', best_objection_strategy: '', avg_lead_score: 0
    };
  }
  const ip = db.industryPatterns[industry];
  ip.calls++;
  if (outcome === 'converted') ip.conversions++;
  ip.avg_duration = Math.round(((ip.avg_duration * (ip.calls - 1)) + durationSeconds) / ip.calls);
  ip.avg_lead_score = Math.round(((ip.avg_lead_score * (ip.calls - 1)) + leadScore) / ip.calls);

  // 6. Track closing signals
  for (const sig of closingSignalsDetected) {
    const key = sig.toLowerCase().trim();
    if (!db.closingSignals[key]) {
      db.closingSignals[key] = { detected: 0, led_to_close: 0, score: 50 };
    }
    db.closingSignals[key].detected++;
    if (outcome === 'converted' || outcome === 'callback_scheduled') {
      db.closingSignals[key].led_to_close++;
    }
    const cs = db.closingSignals[key];
    if (cs.detected >= MIN_SAMPLES_FOR_LEARNING) {
      cs.score = Math.round((cs.led_to_close / cs.detected) * 100);
    }
  }

  // 7. Store session insight (keep last 50)
  db.sessionInsights.push({
    callSid,
    outcome,
    industry,
    durationSeconds,
    turnCount,
    leadScore,
    hookUsed,
    objectionsCount: objectionsEncountered.length,
    timestamp: new Date().toISOString()
  });
  if (db.sessionInsights.length > 50) {
    db.sessionInsights = db.sessionInsights.slice(-50);
  }

  saveLearningDB(db);
  return db;
}

// ── Learning Context for Prompt Builder ─────────────────────────────────

/**
 * Generate learning-informed context to inject into the system prompt.
 * This tells the AI which approaches have been working best.
 */
function getLearningContext(industry = 'general') {
  const db = loadLearningDB();

  if (db.totalCalls < MIN_SAMPLES_FOR_LEARNING) {
    return '=== 15. SELF-LEARNING INSIGHTS ===\nInsufficient data yet — continue building call history for adaptive optimization.';
  }

  const sections = [];
  sections.push('=== 15. SELF-LEARNING INSIGHTS ===');
  sections.push(`Total Calls Analyzed: ${db.totalCalls}`);

  // Conversion rate
  const convRate = db.totalCalls > 0
    ? Math.round(((db.outcomes.converted + db.outcomes.callback_scheduled + db.outcomes.demo_sent) / db.totalCalls) * 100)
    : 0;
  sections.push(`Overall Engagement Rate: ${convRate}%`);

  // Best hooks
  const topHooks = Object.entries(db.hooks)
    .filter(([_, v]) => v.used >= MIN_SAMPLES_FOR_LEARNING)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3);
  if (topHooks.length > 0) {
    sections.push('\nTOP PERFORMING OPENING HOOKS (use these preferentially):');
    topHooks.forEach(([hook, data]) => {
      sections.push(`  • "${hook}" — ${data.score}% engagement (${data.used} uses)`);
    });
  }

  // Worst hooks to avoid
  const worstHooks = Object.entries(db.hooks)
    .filter(([_, v]) => v.used >= MIN_SAMPLES_FOR_LEARNING && v.score < 30)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 2);
  if (worstHooks.length > 0) {
    sections.push('\nAVOID THESE HOOKS (low engagement):');
    worstHooks.forEach(([hook, data]) => {
      sections.push(`  ✗ "${hook}" — only ${data.score}% engagement`);
    });
  }

  // Best objection strategies
  const topObj = Object.entries(db.objectionResponses)
    .filter(([_, v]) => v.attempts >= MIN_SAMPLES_FOR_LEARNING)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3);
  if (topObj.length > 0) {
    sections.push('\nMOST EFFECTIVE OBJECTION STRATEGIES:');
    topObj.forEach(([type, data]) => {
      sections.push(`  • ${type}: ${data.score}% success (${data.continued}/${data.attempts} continued)`);
    });
  }

  // Industry-specific insights
  const ip = db.industryPatterns[industry];
  if (ip && ip.calls >= MIN_SAMPLES_FOR_LEARNING) {
    const indConvRate = ip.calls > 0 ? Math.round((ip.conversions / ip.calls) * 100) : 0;
    sections.push(`\nINDUSTRY INSIGHT (${industry}):`);
    sections.push(`  Calls: ${ip.calls} | Conv Rate: ${indConvRate}% | Avg Duration: ${ip.avg_duration}s | Avg Lead Score: ${ip.avg_lead_score}`);
    if (ip.best_hook) sections.push(`  Best Hook: "${ip.best_hook}"`);
  }

  // Best discovery questions
  const topQs = Object.entries(db.discoveryQuestions)
    .filter(([_, v]) => v.asked >= MIN_SAMPLES_FOR_LEARNING)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3);
  if (topQs.length > 0) {
    sections.push('\nMOST EFFECTIVE DISCOVERY QUESTIONS (ask these first):');
    topQs.forEach(([q, data]) => {
      sections.push(`  • "${q.replace(/_/g, ' ')}" — ${data.score}% useful responses`);
    });
  }

  return sections.join('\n');
}

/**
 * Get ranked hooks for the prompt builder to select from.
 */
function getRankedHooks(industry = 'general') {
  const db = loadLearningDB();
  const hooks = Object.entries(db.hooks)
    .filter(([_, v]) => v.used >= MIN_SAMPLES_FOR_LEARNING)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([hook, data]) => ({ hook, score: data.score, uses: data.used }));
  return hooks;
}

/**
 * Get ranked objection strategies.
 */
function getRankedObjectionStrategies() {
  const db = loadLearningDB();
  return Object.entries(db.objectionResponses)
    .filter(([_, v]) => v.attempts >= MIN_SAMPLES_FOR_LEARNING)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([type, data]) => ({ type, score: data.score, attempts: data.attempts }));
}

/**
 * Get learning summary for dashboard/analytics.
 */
function getLearningSummary() {
  const db = loadLearningDB();
  return {
    totalCalls: db.totalCalls,
    outcomes: db.outcomes,
    lastUpdated: db.lastUpdated,
    topHooks: Object.entries(db.hooks)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([hook, data]) => ({ hook, ...data })),
    topObjectionStrategies: Object.entries(db.objectionResponses)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5)
      .map(([type, data]) => ({ type, ...data })),
    industryPatterns: db.industryPatterns,
    recentSessions: db.sessionInsights.slice(-10)
  };
}

module.exports = {
  recordCallOutcome,
  getLearningContext,
  getRankedHooks,
  getRankedObjectionStrategies,
  getLearningSummary,
  loadLearningDB,
  saveLearningDB,
  LEARNING_DB_PATH
};
