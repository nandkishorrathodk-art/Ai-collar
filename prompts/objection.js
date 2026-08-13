/**
 * PROMPT MODULE 8: ADVANCED OBJECTION ENGINE v2.0
 * 14 objection types with 3-step escalation strategy per objection.
 * Multi-turn tracking: remembers which objections were already addressed.
 *
 * Escalation Strategy:
 *   Step 1: ACKNOWLEDGE — Validate their concern genuinely
 *   Step 2: REFRAME — Shift perspective to value/outcome
 *   Step 3: EVIDENCE — Provide proof, case study, or irresistible offer
 */

const OBJECTIONS = {
  price: {
    reason: 'Prospect feels $297/mo or $499 setup is expensive',
    escalation: [
      { step: 'acknowledge', response: "I completely understand — budget is important. Nobody wants to overspend." },
      { step: 'reframe', response: "Here's the thing though — just 1 saved missed call pays for the entire year of AI service. Most of our clients see ROI in the first week." },
      { step: 'evidence', response: "We had a roofing client who captured a single storm-damage lead worth $12,000 in his first month. That one call paid for 3 years of service." }
    ],
    keywords: ['cost', 'price', 'expensive', 'cheap', 'afford', 'budget', 'money', 'too much', 'pricey']
  },
  already_using: {
    reason: 'Prospect currently uses voicemail or answering service',
    escalation: [
      { step: 'acknowledge', response: "That's smart that you have something in place — most businesses don't even have that." },
      { step: 'reframe', response: "The difference is speed and intelligence. Voicemail makes callers wait. Sarah answers instantly, qualifies the lead, and books appointments in real-time." },
      { step: 'evidence', response: "Most answering services cost $500+/mo and leave callers on hold for 2-3 minutes. Sarah answers in under 1 second with zero delay — and costs half as much." }
    ],
    keywords: ['answering service', 'voicemail', 'already have', 'already use', 'already got', 'current system']
  },
  no_time: {
    reason: 'Prospect claims they are too busy right now',
    escalation: [
      { step: 'acknowledge', response: "No problem at all — I respect your time. You're clearly running a busy operation." },
      { step: 'reframe', response: "Can I send a 15-second interactive text demo to your phone right now? You can check it when you have a moment — no pressure." },
      { step: 'evidence', response: "Most of our clients said the same thing — too busy. That's exactly why they needed Sarah. She handles the calls while they focus on the work." }
    ],
    keywords: ['busy', 'no time', 'not right now', 'in a meeting', 'driving', 'swamped', 'slammed']
  },
  send_email: {
    reason: 'Prospect wants info emailed',
    escalation: [
      { step: 'acknowledge', response: "Happy to do that! Let me get the best email to send it to." },
      { step: 'reframe', response: "Actually, can I also text you a quick 15-second interactive preview? It's way faster than reading a PDF — you'll hear the AI voice live." },
      { step: 'evidence', response: "I'll send both — email with full details and a text with the instant demo. What's the best cell number for the text?" }
    ],
    keywords: ['email', 'mail', 'send info', 'send me', 'write me', 'brochure']
  },
  not_interested: {
    reason: 'Prospect flatly says not interested',
    escalation: [
      { step: 'acknowledge', response: "Totally respect that — I appreciate your honesty." },
      { step: 'reframe', response: "Just so you know — businesses in your industry lose an average of 35% of calls to voicemail. If that ever becomes an issue, we're here." },
      { step: 'evidence', response: "No worries at all. I'll make a note. But I'll tell you — we had a dental practice that said the same thing. 3 months later they signed up after losing a $3,000 patient to a competitor." }
    ],
    keywords: ['not interested', 'no thanks', 'pass', 'no thank you', 'don\'t need', 'don\'t want', 'not for me']
  },
  call_me_later: {
    reason: 'Prospect wants to be called back next week or month',
    escalation: [
      { step: 'acknowledge', response: "Absolutely! I'll make sure we follow up at a better time." },
      { step: 'reframe', response: "What day and time works best for a quick 5-minute call? I'll put it on my calendar right now." },
      { step: 'evidence', response: "Perfect — I'll schedule that callback. In the meantime, want me to text you a quick 15-second demo so you can preview before our next chat?" }
    ],
    keywords: ['call me later', 'call back', 'next week', 'next month', 'another time', 'later', 'follow up']
  },
  need_partner: {
    reason: 'Prospect needs to discuss with business partner or spouse',
    escalation: [
      { step: 'acknowledge', response: "Makes total sense — important decisions should involve the right people." },
      { step: 'reframe', response: "Can I text you a quick 1-page summary so you can share it with your partner? It takes 30 seconds to review." },
      { step: 'evidence', response: "I'll send you a simple ROI breakdown showing exactly how many missed calls equal lost revenue. That usually makes the conversation really easy." }
    ],
    keywords: ['partner', 'wife', 'husband', 'discuss', 'talk to my', 'check with', 'run it by']
  },
  need_demo: {
    reason: 'Prospect wants to test how AI sounds live',
    escalation: [
      { step: 'acknowledge', response: "Great question — you should definitely hear it before deciding." },
      { step: 'reframe', response: "Here's the cool part — you're actually talking to our live AI voice agent right now! Notice how natural and responsive the conversation is." },
      { step: 'evidence', response: "This exact voice is what your customers would hear 24/7. No hold times, no voicemail, instant response. Pretty impressive, right?" }
    ],
    keywords: ['demo', 'test', 'try', 'hear it', 'how does it sound', 'sample', 'example']
  },
  competitor: {
    reason: 'Prospect mentions they use or are considering a competitor',
    escalation: [
      { step: 'acknowledge', response: "Smart to explore your options — comparing solutions is the right approach." },
      { step: 'reframe', response: "What sets us apart is the sales intelligence. Most AI receptionists just answer calls. Sarah qualifies leads, tracks buying signals, and adapts her pitch in real-time." },
      { step: 'evidence', response: "We've had clients switch from [competitor category] who saw a 40% improvement in lead conversion because Sarah doesn't just answer — she sells." }
    ],
    keywords: ['competitor', 'other company', 'alternative', 'someone else', 'different service', 'compared to', 'versus']
  },
  bad_experience: {
    reason: 'Prospect had a bad experience with similar AI or tech before',
    escalation: [
      { step: 'acknowledge', response: "I'm sorry to hear that — bad tech experiences are frustrating, especially when you're investing money." },
      { step: 'reframe', response: "The AI industry has changed dramatically even in the last 6 months. Our system uses the latest conversational AI that sounds and responds like a real person." },
      { step: 'evidence', response: "I'll tell you what — let me text you a 15-second demo. If it doesn't sound completely different from what you tried before, I'll never call again. Deal?" }
    ],
    keywords: ['bad experience', 'tried before', 'didn\'t work', 'waste of money', 'burned', 'failed', 'terrible']
  },
  contract_lock: {
    reason: 'Prospect is locked into a contract with another provider',
    escalation: [
      { step: 'acknowledge', response: "I understand — contracts can be tricky. When does your current one end?" },
      { step: 'reframe', response: "No rush at all. Let me send you a comparison so you have it ready when your contract is up. What's the best email?" },
      { step: 'evidence', response: "Actually, many of our clients use Sarah alongside their current system at first. Once they see the difference in lead quality, the switch happens naturally." }
    ],
    keywords: ['contract', 'locked in', 'commitment', 'agreement', 'cancellation fee', 'stuck with', 'bound']
  },
  diy_solution: {
    reason: 'Prospect thinks they can build it themselves or handle it in-house',
    escalation: [
      { step: 'acknowledge', response: "I love the DIY spirit — that's the sign of a hands-on business owner." },
      { step: 'reframe', response: "The question is — is building and maintaining an AI phone system the best use of your time? Most business owners realize their time is worth more on revenue-generating work." },
      { step: 'evidence', response: "We had a tech-savvy client try to build their own. After 3 months and $5,000 in dev costs, they switched to Sarah. Setup took 60 seconds and worked out of the box." }
    ],
    keywords: ['build it', 'do it myself', 'my own', 'in-house', 'staff can', 'we handle', 'homegrown', 'diy']
  },
  team_resistance: {
    reason: 'Prospect says their team or staff won\'t want AI',
    escalation: [
      { step: 'acknowledge', response: "That's a totally valid concern. Change management is real, and your team's buy-in matters." },
      { step: 'reframe', response: "The great news is — Sarah doesn't replace your team. She handles the overflow calls that nobody can get to. Your team focuses on in-person clients while Sarah handles the phone." },
      { step: 'evidence', response: "Most teams actually love it after the first week. One dental office said their receptionist was 'finally able to breathe' because Sarah handled 60% of routine calls." }
    ],
    keywords: ['team won\'t', 'staff won\'t', 'employees', 'replace', 'my people', 'resistance', 'pushback']
  },
  no_budget: {
    reason: 'Prospect has genuine budget constraints',
    escalation: [
      { step: 'acknowledge', response: "I hear you — cash flow is king, especially in small business." },
      { step: 'reframe', response: "Think of it this way — Sarah costs less than $10 per day. If she saves even one missed call per week, that revenue covers her cost 10 times over." },
      { step: 'evidence', response: "We also have a starter plan that's even lower cost. And if you're not seeing ROI in 30 days, there's zero risk. Want me to walk you through the starter option?" }
    ],
    keywords: ['no budget', 'can\'t afford', 'tight budget', 'cash flow', 'bootstrapping', 'saving up', 'limited funds']
  }
};

// Track which objections have been addressed per call (multi-turn tracking)
const addressedObjections = new Map(); // callSid -> Set<objection_type>

function getObjectionStrategy(text = '', callSid = null) {
  const lower = String(text).toLowerCase();
  let matchedKey = null;

  for (const [key, obj] of Object.entries(OBJECTIONS)) {
    if (obj.keywords.some(kw => lower.includes(kw))) {
      matchedKey = key;
      break;
    }
  }

  if (!matchedKey) return { ...OBJECTIONS.no_time.escalation[0], type: 'no_time', escalationStep: 0 };

  const objection = OBJECTIONS[matchedKey];

  // Multi-turn: check which escalation step we're on
  if (callSid) {
    if (!addressedObjections.has(callSid)) {
      addressedObjections.set(callSid, new Map());
    }
    const addressed = addressedObjections.get(callSid);
    const currentStep = addressed.get(matchedKey) || 0;
    const escalationStep = Math.min(currentStep, objection.escalation.length - 1);
    addressed.set(matchedKey, currentStep + 1);

    return {
      type: matchedKey,
      reason: objection.reason,
      escalationStep,
      ...objection.escalation[escalationStep],
      totalSteps: objection.escalation.length,
      isEscalated: escalationStep > 0
    };
  }

  return {
    type: matchedKey,
    reason: objection.reason,
    escalationStep: 0,
    ...objection.escalation[0],
    totalSteps: objection.escalation.length,
    isEscalated: false
  };
}

/**
 * Get multi-turn objection strategy with escalation context.
 */
function getMultiTurnObjectionStrategy(text = '', callSid = null) {
  return getObjectionStrategy(text, callSid);
}

/**
 * Clear objection tracking for a call (on call end).
 */
function clearCallObjections(callSid) {
  addressedObjections.delete(callSid);
}

function getObjectionContext(text, callSid = null) {
  const obj = getObjectionStrategy(text, callSid);
  const escalationLabel = ['ACKNOWLEDGE', 'REFRAME', 'EVIDENCE'][obj.escalationStep] || 'ACKNOWLEDGE';
  return `=== 8. ADVANCED OBJECTION STRATEGY (WITH PROOF & CASE STUDIES) ===
Objection Type: ${obj.type}
Reason: ${obj.reason}
Escalation Step: ${escalationLabel} (${obj.escalationStep + 1}/${obj.totalSteps})
${obj.isEscalated ? 'NOTE: This objection was raised before. Escalate response with a specific case study / proof point.' : ''}
Strategy: ${obj.step}
Suggested Response: "${obj.response}"

PROOF & CASE STUDY INSTRUCTION:
- Always back up your objection answer with a concrete mini case study (e.g., "Dr. Miller's dental office in Austin caught 14 after-hours emergency patients in month one, adding $16,800 in revenue").
- After addressing the objection with proof, ALWAYS transition immediately to asking for a live 5-minute demo booking: "Can I show you how it works live for 5 minutes tomorrow?"`;
}

module.exports = {
  OBJECTIONS,
  getObjectionStrategy,
  getMultiTurnObjectionStrategy,
  clearCallObjections,
  getObjectionContext
};
