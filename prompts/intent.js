/**
 * PROMPT MODULE 4: INTENT ENGINE
 * Classifies caller statements into actionable intent categories.
 */

const INTENTS = {
  GREETING: ['hello', 'hi', 'hey', 'who is this', 'speaking', 'yes'],
  QUESTION: ['how does it work', 'what do you do', 'can it answer', 'what is this'],
  PRICING: ['how much', 'cost', 'pricing', 'price', 'rates', 'subscription'],
  OBJECTION: ['not interested', 'too expensive', 'already have', 'no time', 'send email', 'busy'],
  BOOKING: ['book', 'schedule', 'appointment', 'demo', 'tomorrow', 'calendar', 'time slot'],
  SMS_REQUEST: ['send link', 'text me', 'send sms', 'send demo', 'text link'],
  TRANSFER: ['speak to owner', 'human', 'real person', 'manager'],
  VOICEMAIL: ['leave a message', 'voicemail', 'beep', 'after the tone'],
  GOODBYE: ['bye', 'thank you', 'that is all', 'gotta go', 'have a good day'],
  DO_NOT_CALL: ['take me off', 'remove my number', 'do not call', 'stop calling', 'unsubscribe']
};

function detectIntent(text = '') {
  const lower = String(text).toLowerCase().trim();
  if (!lower) return 'UNKNOWN';

  for (const [intent, keywords] of Object.entries(INTENTS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return intent;
    }
  }

  return 'QUESTION';
}

function getIntentContext(intent) {
  return `=== 4. CURRENT INTENT: ${intent} ===
Target Action: Address ${intent} intent directly and keep conversation moving towards booking.`;
}

module.exports = {
  INTENTS,
  detectIntent,
  getIntentContext
};
