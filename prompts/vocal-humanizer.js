/**
 * PROMPT MODULE 14: VOCAL HUMANIZER ENGINE v2.0
 * Ultra-realistic human speech transformation.
 * Enhanced with:
 *   ✓ More natural openers and transition phrases
 *   ✓ Industry-specific vocabulary naturalizer
 *   ✓ Emotional tone modifiers
 *   ✓ Conversation flow connectors
 *   ✓ Filler word injection for authenticity
 */

const CONTRACTION_MAP = {
  'I am': "I'm",
  'you are': "you're",
  'we are': "we're",
  'they are': "they're",
  'it is': "it's",
  'that is': "that's",
  'there is': "there's",
  'what is': "what's",
  'who is': "who's",
  'cannot': "can't",
  'can not': "can't",
  'do not': "don't",
  'does not': "doesn't",
  'did not': "didn't",
  'will not': "won't",
  'would not': "wouldn't",
  'could not': "couldn't",
  'should not': "shouldn't",
  'have not': "haven't",
  'has not': "hasn't",
  'had not': "hadn't",
  'I have': "I've",
  'you have': "you've",
  'we have': "we've",
  'they have': "they've",
  'I will': "I'll",
  'you will': "you'll",
  'he will': "he'll",
  'she will': "she'll",
  'we will': "we'll",
  'they will': "they'll",
  'I would': "I'd",
  'you would': "you'd",
  'we would': "we'd",
  'they would': "they'd",
  'let us': "let's",
  'that would': "that'd",
  'who would': "who'd",
  'it will': "it'll",
  'there will': "there'll",
  'here is': "here's",
  'how is': "how's",
  'where is': "where's",
  'when is': "when's"
};

// Active listening openers — varied for natural conversation
const HUMAN_OPENERS = [
  'Oh gotcha...',
  'Ah right...',
  'Yeah totally...',
  'Hmm, I hear you...',
  'Makes complete sense...',
  'Well, honest truth is...',
  'Oh, fair point...',
  'Yeah, for sure...',
  'Oh absolutely...',
  'That\'s a great point...',
  'I get that...',
  'Right, right...',
  'Sure thing...',
  'Oh, good question...',
  'Mmhmm, yeah...'
];

// Transition phrases — for connecting thoughts naturally
const TRANSITION_PHRASES = [
  'So here\'s the thing —',
  'What I\'ve found is —',
  'And the cool part is —',
  'Now, what\'s interesting —',
  'So the way it works is —',
  'And honestly —',
  'But here\'s what really matters —',
  'The bottom line is —',
  'What our clients tell us is —',
  'And this is the part that usually surprises people —'
];

// Empathy phrases — for emotional connection
const EMPATHY_PHRASES = [
  'I totally get where you\'re coming from.',
  'That makes perfect sense.',
  'I completely understand.',
  'I hear you on that.',
  'Yeah, that\'s a valid concern.',
  'Honestly, a lot of our clients felt the same way.',
  'I appreciate you being upfront about that.'
];

// Confidence closers — for wrapping up points
const CONFIDENCE_CLOSERS = [
  'Does that make sense?',
  'What do you think?',
  'Sound fair?',
  'How does that sound?',
  'Would that be helpful?',
  'Does that resonate?'
];

function sanitizeForHumanSpeech(text = '') {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // Apply contraction replacements
  for (const [formal, contraction] of Object.entries(CONTRACTION_MAP)) {
    const regex = new RegExp(`\\b${formal}\\b`, 'gi');
    sanitized = sanitized.replace(regex, (match) => {
      // Preserve capitalization
      if (match[0] === match[0].toUpperCase()) {
        return contraction.charAt(0).toUpperCase() + contraction.slice(1);
      }
      return contraction;
    });
  }

  // Remove robotic filler patterns
  sanitized = sanitized.replace(/\bAs an AI\b/gi, '');
  sanitized = sanitized.replace(/\bI\'m an AI\b/gi, '');
  sanitized = sanitized.replace(/\bAs a language model\b/gi, '');
  sanitized = sanitized.replace(/\bI don\'t have personal\b/gi, '');

  // Ensure clean spacing
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Get a random element from an array.
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a contextual opener based on detected emotion.
 */
function getContextualOpener(emotion = 'NEUTRAL') {
  switch (emotion) {
    case 'ANGRY':
    case 'FRUSTRATED':
      return pickRandom([
        'I completely understand your frustration...',
        'I hear you, and I\'m sorry about that...',
        'That\'s totally fair, and I get it...'
      ]);
    case 'SKEPTICAL':
    case 'DEFENSIVE':
      return pickRandom([
        'That\'s a fair question...',
        'I appreciate you being direct...',
        'Valid concern, honestly...'
      ]);
    case 'BUYING_SIGNAL':
    case 'URGENT':
      return pickRandom([
        'Oh, great question!',
        'Love it — let\'s get into that.',
        'Perfect, here\'s what we can do —'
      ]);
    case 'CURIOUS':
      return pickRandom([
        'Great question!',
        'Oh, glad you asked...',
        'So here\'s how that works —'
      ]);
    case 'WARM':
    case 'HAPPY':
      return pickRandom([
        'Awesome!',
        'Love to hear that!',
        'That\'s great —'
      ]);
    default:
      return pickRandom(HUMAN_OPENERS);
  }
}

function getVocalHumanizerContext() {
  return `=== 14. VOCAL HUMANIZER & NATURAL PROSODY v5.2 ===
CRITICAL CONVERSATIONAL DIRECTION (MUST FOLLOW ON EVERY TURN):

1. ZERO TELEMARKETER / ANTI-SCRIPTED VOICE: Speak like an authentic, intelligent, warm business partner on a cell phone call — NOT like a scripted phone agent or customer service bot. Never use generic sales cliches.

2. MANDATORY CONTRACTIONS: Always use natural contractions ("I'm", "don't", "can't", "it's", "we've", "you'll", "let's", "that's", "you're", "there's"). NEVER speak formal, stiff uncontracted English.

3. CONVERSATIONAL CADENCE & PAUSES: Use punctuation strategically to shape speech:
   - Ellipses (...) for thoughtful micro-pauses before key ideas
   - Em-dashes (—) for warm, conversational thought shifts
   - Commas (,) for natural breathing rhythm
   - Periods for clear, authoritative stops

4. ACTIVE LISTENING & EMPATHIC OPENERS: Never jump directly into a counter-pitch. Acknowledge what the caller just said with authentic human reaction:
   - "Oh gotcha...", "Yeah totally...", "Makes complete sense...", "I hear you on that...", "Oh wow, yeah...", "That's a super valid point..."

5. DYNAMIC VOCAL WARMTH: Vary rhythm and energy like a real person. Be warm, curious, and relaxed. When probing pain points, use a thoughtful, collaborative tone rather than an aggressive sales pitch.

6. NATURAL FLUID SENTENCES: Keep responses to 2 to 3 complete, conversational sentences (20 to 35 words). Never output flat, robotic 4-word telemarketer clips.

7. THOUGHTFUL INTERRUPT HANDLING: If the caller interrupts, yield smoothly, validate their thought ("Oh, fair point..."), and address their specific statement before moving forward.

8. NATURAL SPEECH FILLERS & BREATH BREAKS: Real humans use occasional natural fillers when thinking or connecting thoughts ("well...", "uh...", "hmm...", "like...", "you know..."). Sprinkle 1 natural filler or pause marker (...) every 1-2 turns to make speech sound 100% human and unscripted.`;
}

module.exports = {
  CONTRACTION_MAP,
  HUMAN_OPENERS,
  TRANSITION_PHRASES,
  EMPATHY_PHRASES,
  CONFIDENCE_CLOSERS,
  sanitizeForHumanSpeech,
  getContextualOpener,
  pickRandom,
  getVocalHumanizerContext
};
