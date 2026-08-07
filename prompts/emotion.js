/**
 * PROMPT MODULE 5: EMOTION & BUYING SIGNALS ENGINE
 * Tracks tone, sentiment, and buying signals to calculate real-time lead score.
 */

const EMOTIONS = {
  INTERESTED: { keywords: ['sounds good', 'interesting', 'tell me more', 'cool', 'awesome'], confidence: 0.9, weight: 15 },
  BUSY: { keywords: ['busy right now', 'in a meeting', 'driving', 'call later'], confidence: 0.85, weight: -10 },
  ANGRY: { keywords: ['stop', 'annoying', 'scam', 'spam', 'hate', 'furious'], confidence: 0.95, weight: -50 },
  HAPPY: { keywords: ['great', 'nice', 'wonderful', 'thanks', 'glad'], confidence: 0.8, weight: 10 },
  CONFUSED: { keywords: ['huh', 'what do you mean', 'confused', 'not sure'], confidence: 0.75, weight: 0 },
  BUYING_SIGNAL: { keywords: ['how fast', 'can we start', 'send contract', 'sign up', 'where do i pay', 'what is the cost'], confidence: 0.95, weight: 35 },
  SILENT: { keywords: [], confidence: 0.6, weight: -5 },
  NEUTRAL: { keywords: [], confidence: 0.5, weight: 0 }
};

function detectEmotion(text = '') {
  const lower = String(text).toLowerCase().trim();
  if (!lower || lower.length < 2) {
    return { emotion: 'SILENT', confidence: 0.6, weight: -5 };
  }

  for (const [emotionKey, data] of Object.entries(EMOTIONS)) {
    if (data.keywords.length > 0 && data.keywords.some((kw) => lower.includes(kw))) {
      return { emotion: emotionKey, confidence: data.confidence, weight: data.weight };
    }
  }

  return { emotion: 'NEUTRAL', confidence: 0.5, weight: 0 };
}

function analyzeBuyingSignals(text = '') {
  const lower = String(text).toLowerCase();
  
  const signals = {
    asksPrice: lower.includes('how much') || lower.includes('cost') || lower.includes('pricing') || lower.includes('fee'),
    asksDemo: lower.includes('demo') || lower.includes('show me') || lower.includes('test') || lower.includes('preview'),
    asksSMS: lower.includes('text') || lower.includes('sms') || lower.includes('send link') || lower.includes('mobile'),
    asksEmail: lower.includes('email') || lower.includes('send info') || lower.includes('mail'),
    asksROI: lower.includes('results') || lower.includes('roi') || lower.includes('leads') || lower.includes('save'),
    asksIntegration: lower.includes('integrate') || lower.includes('connect') || lower.includes('crm') || lower.includes('calendar')
  };

  // Compute incremental lead score
  let scoreDelta = 0;
  if (signals.asksPrice) scoreDelta += 15;
  if (signals.asksDemo) scoreDelta += 20;
  if (signals.asksSMS) scoreDelta += 10;
  if (signals.asksROI) scoreDelta += 20;
  if (signals.asksIntegration) scoreDelta += 15;

  return {
    signals,
    scoreDelta
  };
}

function getEmotionContext(emotionData, signalsData, currentLeadScore = 0) {
  const newScore = Math.min(100, Math.max(0, currentLeadScore + (emotionData.weight || 0) + (signalsData.scoreDelta || 0)));
  const sigList = Object.entries(signalsData.signals)
    .filter(([_, active]) => active)
    .map(([key]) => key)
    .join(', ');

  return `=== 5. EMOTION & BUYING SIGNALS ===
Current Sentiment: ${emotionData.emotion}
Detected Signals: ${sigList || 'None yet'}
Dynamic Lead Score: ${newScore}/100`;
}

module.exports = {
  EMOTIONS,
  detectEmotion,
  analyzeBuyingSignals,
  getEmotionContext
};
