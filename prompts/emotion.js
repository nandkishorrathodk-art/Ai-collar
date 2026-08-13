/**
 * PROMPT MODULE 5: ADVANCED EMOTION & BUYING SIGNALS ENGINE v2.0
 * Granular emotion detection with context awareness.
 * Enhanced buying signal analysis with weighted scoring.
 * New emotions: SKEPTICAL, WARM, URGENT, DEFENSIVE, CURIOUS, FRUSTRATED
 */

const EMOTIONS = {
  INTERESTED: { 
    keywords: ['sounds good', 'interesting', 'tell me more', 'cool', 'awesome', 'go on', 'continue', 'really', 'oh wow'],
    confidence: 0.9, weight: 15 
  },
  BUYING_SIGNAL: { 
    keywords: ['how fast', 'can we start', 'send contract', 'sign up', 'where do i pay', 'what is the cost', 'how much', 'pricing', 'when can', 'let\'s do it', 'i\'m ready', 'sign me up', 'take my money'],
    confidence: 0.95, weight: 35 
  },
  WARM: {
    keywords: ['that makes sense', 'i like that', 'good point', 'you\'re right', 'fair enough', 'i can see that', 'helpful', 'appreciate'],
    confidence: 0.85, weight: 12
  },
  CURIOUS: {
    keywords: ['how does', 'what about', 'can it', 'does it', 'what if', 'tell me about', 'how would', 'explain', 'what kind'],
    confidence: 0.8, weight: 10
  },
  HAPPY: { 
    keywords: ['great', 'nice', 'wonderful', 'thanks', 'glad', 'perfect', 'excellent', 'amazing', 'fantastic'],
    confidence: 0.8, weight: 10 
  },
  URGENT: {
    keywords: ['right now', 'immediately', 'asap', 'emergency', 'urgent', 'can\'t wait', 'today', 'this week'],
    confidence: 0.9, weight: 20
  },
  SKEPTICAL: {
    keywords: ['really', 'are you sure', 'sounds too good', 'doubt', 'prove it', 'i don\'t believe', 'yeah right', 'hard to believe', 'skeptical'],
    confidence: 0.85, weight: -5
  },
  BUSY: { 
    keywords: ['busy right now', 'in a meeting', 'driving', 'call later', 'not a good time', 'on the road', 'at work'],
    confidence: 0.85, weight: -10 
  },
  CONFUSED: { 
    keywords: ['huh', 'what do you mean', 'confused', 'not sure', 'i don\'t understand', 'what', 'come again', 'sorry what'],
    confidence: 0.75, weight: 0 
  },
  FRUSTRATED: {
    keywords: ['frustrated', 'tired of', 'sick of', 'fed up', 'waste', 'disappointed', 'annoying', 'bothered'],
    confidence: 0.85, weight: -15
  },
  DEFENSIVE: {
    keywords: ['why should i', 'who are you', 'how did you get', 'where did you', 'are you a bot', 'is this a scam', 'are you real', 'who gave you'],
    confidence: 0.9, weight: -20
  },
  ANGRY: { 
    keywords: ['stop calling', 'don\'t call', 'scam', 'spam', 'hate', 'furious', 'do not call', 'remove me', 'block', 'reported'],
    confidence: 0.95, weight: -50 
  },
  SILENT: { keywords: [], confidence: 0.6, weight: -5 },
  NEUTRAL: { keywords: [], confidence: 0.5, weight: 0 }
};

function detectEmotion(text = '') {
  const lower = String(text).toLowerCase().trim();
  if (!lower || lower.length < 2) {
    return { emotion: 'SILENT', confidence: 0.6, weight: -5 };
  }

  // Priority-based detection (check high-impact emotions first)
  const priorityOrder = [
    'ANGRY', 'BUYING_SIGNAL', 'DEFENSIVE', 'URGENT',
    'FRUSTRATED', 'SKEPTICAL', 'INTERESTED', 'WARM',
    'CURIOUS', 'HAPPY', 'BUSY', 'CONFUSED'
  ];

  for (const emotionKey of priorityOrder) {
    const data = EMOTIONS[emotionKey];
    if (data.keywords.length > 0 && data.keywords.some((kw) => lower.includes(kw))) {
      return { emotion: emotionKey, confidence: data.confidence, weight: data.weight };
    }
  }

  return { emotion: 'NEUTRAL', confidence: 0.5, weight: 0 };
}

function analyzeBuyingSignals(text = '') {
  const lower = String(text).toLowerCase();
  
  const signals = {
    asksPrice: lower.includes('how much') || lower.includes('cost') || lower.includes('pricing') || lower.includes('fee') || lower.includes('rate'),
    asksDemo: lower.includes('demo') || lower.includes('show me') || lower.includes('test') || lower.includes('preview') || lower.includes('try it'),
    asksSMS: lower.includes('text') || lower.includes('sms') || lower.includes('send link') || lower.includes('mobile') || lower.includes('phone number'),
    asksEmail: lower.includes('email') || lower.includes('send info') || lower.includes('mail'),
    asksROI: lower.includes('results') || lower.includes('roi') || lower.includes('leads') || lower.includes('save') || lower.includes('revenue') || lower.includes('growth'),
    asksIntegration: lower.includes('integrate') || lower.includes('connect') || lower.includes('crm') || lower.includes('calendar') || lower.includes('sync'),
    asksTimeline: lower.includes('how long') || lower.includes('how fast') || lower.includes('when can') || lower.includes('start today') || lower.includes('how soon'),
    asksComparison: lower.includes('compare') || lower.includes('versus') || lower.includes('better than') || lower.includes('difference'),
    wantsToClose: lower.includes('sign up') || lower.includes('get started') || lower.includes('let\'s do it') || lower.includes('i\'m in') || lower.includes('deal') || lower.includes('where do i pay')
  };

  // Weighted scoring — closing signals worth more
  let scoreDelta = 0;
  if (signals.asksPrice) scoreDelta += 15;
  if (signals.asksDemo) scoreDelta += 20;
  if (signals.asksSMS) scoreDelta += 10;
  if (signals.asksROI) scoreDelta += 20;
  if (signals.asksIntegration) scoreDelta += 15;
  if (signals.asksTimeline) scoreDelta += 25;
  if (signals.asksComparison) scoreDelta += 10;
  if (signals.wantsToClose) scoreDelta += 40;

  return {
    signals,
    scoreDelta,
    isClosingSignal: signals.wantsToClose || signals.asksTimeline
  };
}

function getEmotionContext(emotionData, signalsData, currentLeadScore = 0) {
  const newScore = Math.min(100, Math.max(0, currentLeadScore + (emotionData.weight || 0) + (signalsData.scoreDelta || 0)));
  const sigList = Object.entries(signalsData.signals)
    .filter(([_, active]) => active)
    .map(([key]) => key)
    .join(', ');

  let closingAdvice = '';
  if (signalsData.isClosingSignal) {
    closingAdvice = '\n🎯 CLOSING SIGNAL DETECTED — The prospect is showing strong buying intent. Move toward closing NOW.';
  } else if (newScore >= 70) {
    closingAdvice = '\n📈 HIGH LEAD SCORE — Prospect is warm. Start transitioning toward a closing question.';
  } else if (emotionData.emotion === 'SKEPTICAL' || emotionData.emotion === 'DEFENSIVE') {
    closingAdvice = '\n⚠️ RESISTANCE DETECTED — Focus on building trust. Share evidence and social proof before asking for commitment.';
  }

  return `=== 5. EMOTION & BUYING SIGNALS ===
Current Sentiment: ${emotionData.emotion} (confidence: ${(emotionData.confidence * 100).toFixed(0)}%)
Detected Signals: ${sigList || 'None yet'}
Dynamic Lead Score: ${newScore}/100${closingAdvice}`;
}

module.exports = {
  EMOTIONS,
  detectEmotion,
  analyzeBuyingSignals,
  getEmotionContext
};
