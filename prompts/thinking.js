/**
 * PROMPT MODULE 3: THINKING LEVELS ENGINE
 * Dynamically adjusts response depth & latency budget based on conversation context.
 */

const THINKING_LEVELS = {
  FAST: {
    maxWords: 22,
    temperature: 0.45,
    description: 'Quick acknowledgment, simple answers, short confirmations'
  },
  NORMAL: {
    maxWords: 35,
    temperature: 0.65,
    description: 'Standard conversation turn, answering FAQs, pitching benefits'
  },
  DEEP: {
    maxWords: 45,
    temperature: 0.7,
    description: 'Handling complex objections, detailed industry ROI calculations'
  },
  NEGOTIATION: {
    maxWords: 40,
    temperature: 0.65,
    description: 'Discussing custom packages, pricing options, setup guarantees'
  },
  CLOSING: {
    maxWords: 28,
    temperature: 0.5,
    description: 'Booking calendar time, collecting contact info, final agreement'
  }
};

function chooseThinking(intent = 'greeting') {
  const norm = String(intent).toLowerCase();

  if (['greeting', 'goodbye', 'acknowledgment', 'voicemail'].includes(norm)) {
    return 'FAST';
  }
  if (['pricing', 'package', 'features'].includes(norm)) {
    return 'NORMAL';
  }
  if (['objection', 'competitor', 'security', 'hesitation'].includes(norm)) {
    return 'DEEP';
  }
  if (['custom_quote', 'discount', 'contract'].includes(norm)) {
    return 'NEGOTIATION';
  }
  if (['booking', 'appointment', 'schedule', 'send_sms'].includes(norm)) {
    return 'CLOSING';
  }

  return 'NORMAL';
}

function getThinkingContext(intent) {
  const levelKey = chooseThinking(intent);
  const level = THINKING_LEVELS[levelKey];
  return `=== 3. THINKING LEVEL: ${levelKey} ===
Max Words Target: ${level.maxWords} words
Strategy: ${level.description}`;
}

module.exports = {
  THINKING_LEVELS,
  chooseThinking,
  getThinkingContext
};
