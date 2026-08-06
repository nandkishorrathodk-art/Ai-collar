/**
 * Lightweight objection-engine scaffold.
 * It is intentionally simple, deterministic, and safe for future tool-calling.
 */

const OBJECTION_DB = {
  too_expensive: {
    intent: 'pricing',
    response: 'I hear that. The real question is whether missed calls are costing you more than the monthly fee.'
  },
  already_have_receptionist: {
    intent: 'comparison',
    response: 'That makes sense. Does your current team answer at 2 AM and on weekends, every single time?'
  },
  send_email: {
    intent: 'follow_up',
    response: 'Totally fair. I can send the quick info over right now and keep it simple.'
  },
  busy: {
    intent: 'callback',
    response: 'No problem at all. I can just text you the demo link and let you check it when it fits.'
  },
  not_owner: {
    intent: 'routing',
    response: 'Perfect. Can you connect me with the decision maker for a quick two-minute look?'
  },
  no_budget: {
    intent: 'budget',
    response: 'Got it. If it saves only one missed lead per month, it usually pays for itself quickly.'
  },
  dont_like_ai: {
    intent: 'trust',
    response: 'Totally fair. The goal is not to replace your team — it is to answer the calls they cannot take.'
  },
  call_me_later: {
    intent: 'follow_up',
    response: 'Sure thing. I can send the details now and you can review them when it is easier.'
  },
  send_portfolio: {
    intent: 'proof',
    response: 'Absolutely. I can send the portfolio link and a short demo snapshot right away.'
  },
  already_have_website: {
    intent: 'positioning',
    response: 'That is perfect. This is not a website replacement. It is a call-answering and lead-capture layer on top.'
  },
  wife_decides: {
    intent: 'decision',
    response: 'That is completely normal. I can keep the details very simple so the decision maker can review them later.'
  },
  partner_decides: {
    intent: 'decision',
    response: 'That is completely normal. I can send the summary over so both of you can look it over when it is convenient.'
  }
};

function pickObjectionResponse(key, fallback = 'I hear you. Let me keep it simple and helpful.') {
  const normalized = String(key || '').trim().toLowerCase().replace(/\s+/g, '_');
  return OBJECTION_DB[normalized]?.response || fallback;
}

module.exports = {
  OBJECTION_DB,
  pickObjectionResponse
};
