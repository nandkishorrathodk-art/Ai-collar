/**
 * PROMPT MODULE 5: EMOTION ENGINE
 * 8 emotions: INTERESTED, BUSY, ANGRY, HAPPY, CONFUSED, BUYING_SIGNAL, SILENT, NEUTRAL
 * Analyzes caller tone/mood to adapt voice empathy, pacing, and re-engagement.
 */

const EMOTIONS = {
  INTERESTED: {
    keywords: ['sounds good', 'interesting', 'tell me more', 'cool', 'awesome', 'really', 'nice'],
    confidence: 0.9,
    guidance: 'Capitalize on interest — move towards booking or demo SMS immediately.'
  },
  BUSY: {
    keywords: ['busy right now', 'in a meeting', 'driving', 'call later', 'bad time'],
    confidence: 0.85,
    guidance: 'Offer a quick 15-second SMS demo link. Respect their time.'
  },
  ANGRY: {
    keywords: ['stop', 'annoying', 'scam', 'spam', 'hate', 'furious', 'ridiculous', 'harassment'],
    confidence: 0.95,
    guidance: 'De-escalate immediately. Apologize and offer DNC removal. Do NOT push the pitch.'
  },
  HAPPY: {
    keywords: ['great', 'nice', 'wonderful', 'thanks', 'glad', 'perfect', 'love it'],
    confidence: 0.8,
    guidance: 'Maintain positive momentum. Transition smoothly towards booking.'
  },
  CONFUSED: {
    keywords: ['huh', 'what do you mean', 'confused', 'not sure', 'i dont understand', 'explain'],
    confidence: 0.75,
    guidance: 'Simplify your explanation. Use a concrete example or analogy.'
  },
  BUYING_SIGNAL: {
    keywords: ['how fast', 'can we start', 'send contract', 'sign up', 'where do i pay', 'how do i get started', 'lets do it'],
    confidence: 0.95,
    guidance: 'CLOSE IMMEDIATELY. Do not over-explain. Trigger BOOK_APPOINTMENT or SEND_INVOICE.'
  },
  SILENT: {
    keywords: [],
    confidence: 0.6,
    guidance: 'Caller has gone silent. Gently re-engage: "Are you still there?" or "I want to make sure I am answering your question."'
  },
  NEUTRAL: {
    keywords: [],
    confidence: 0.5,
    guidance: 'Standard conversational tone. Continue pitch flow naturally.'
  }
};

/**
 * Detect emotion from caller speech text.
 * SILENT is detected when text is empty or extremely short.
 */
function detectEmotion(text = '') {
  const lower = String(text).toLowerCase().trim();

  // Silent detection: empty or very short non-word utterances
  if (!lower || lower.length < 2) {
    return { emotion: 'SILENT', confidence: 0.6, guidance: EMOTIONS.SILENT.guidance };
  }

  for (const [emotionKey, data] of Object.entries(EMOTIONS)) {
    if (data.keywords.length > 0 && data.keywords.some((kw) => lower.includes(kw))) {
      return { emotion: emotionKey, confidence: data.confidence, guidance: data.guidance };
    }
  }

  return { emotion: 'NEUTRAL', confidence: 0.5, guidance: EMOTIONS.NEUTRAL.guidance };
}

function getEmotionContext(emotionData) {
  const { emotion, confidence, guidance } = emotionData || {};
  return `=== 5. EMOTION ENGINE ===
Detected Emotion: ${emotion || 'NEUTRAL'} (Confidence: ${confidence || 0.5})
Guidance: ${guidance || 'Standard conversational tone.'}`;
}

module.exports = {
  EMOTIONS,
  detectEmotion,
  getEmotionContext
};
