/**
 * PROMPT MODULE 8: OBJECTION ENGINE
 * 8 high-converting objection handling strategies with reason → strategy → response.
 */

const OBJECTIONS = {
  price: {
    reason: 'Prospect feels $297/mo or $499 setup is expensive',
    strategy: 'Reframe cost against 1 single saved client sale',
    response: 'I completely understand! But just 1 saved missed call pays for the entire year of AI service.'
  },
  already_using: {
    reason: 'Prospect currently uses voicemail or answering service',
    strategy: 'Highlight 24/7 instant AI conversation vs slow voicemail text',
    response: 'Most answering services cost $500+/mo and leave callers on hold. Sarah answers instantly with 0 delay.'
  },
  no_time: {
    reason: 'Prospect claims they are too busy right now',
    strategy: 'Offer 15-second instant text demo',
    response: 'No problem at all! Can I send a 15-second interactive text demo to your phone right now?'
  },
  send_email: {
    reason: 'Prospect wants info emailed',
    strategy: 'Agree, confirm cell phone for instant SMS demo link',
    response: 'Happy to do that! What is the best cell number to text the quick preview link to?'
  },
  not_interested: {
    reason: 'Prospect flatly says not interested',
    strategy: 'Acknowledge respectfully, plant a seed with industry stat',
    response: 'Totally respect that! Just so you know — businesses in your industry lose an average of 35% of calls to voicemail. If that ever becomes an issue, we are here.'
  },
  call_me_later: {
    reason: 'Prospect wants to be called back next week or month',
    strategy: 'Agree enthusiastically and lock in a specific callback date/time',
    response: 'Absolutely! What day and time works best for a quick 5-minute call? I will put it on my calendar right now.'
  },
  need_partner: {
    reason: 'Prospect needs to discuss with business partner or spouse',
    strategy: 'Offer to send a quick summary text they can share with their partner',
    response: 'Makes total sense! Can I text you a quick 1-page summary so you can share it with your partner? It takes 30 seconds to review.'
  },
  need_demo: {
    reason: 'Prospect wants to test how AI sounds live',
    strategy: 'Explain this call IS the live AI agent',
    response: 'You are actually talking to our live AI voice agent right now! Notice how natural and responsive it is.'
  }
};

function getObjectionStrategy(text = '') {
  const lower = String(text).toLowerCase();

  if (lower.includes('cost') || lower.includes('price') || lower.includes('expensive') || lower.includes('cheap')) return OBJECTIONS.price;
  if (lower.includes('answering service') || lower.includes('voicemail') || lower.includes('already have') || lower.includes('already use')) return OBJECTIONS.already_using;
  if (lower.includes('busy') || lower.includes('no time') || lower.includes('not right now')) return OBJECTIONS.no_time;
  if (lower.includes('email') || lower.includes('mail') || lower.includes('send info')) return OBJECTIONS.send_email;
  if (lower.includes('not interested') || lower.includes('no thanks') || lower.includes('pass')) return OBJECTIONS.not_interested;
  if (lower.includes('call me later') || lower.includes('call back') || lower.includes('next week') || lower.includes('next month')) return OBJECTIONS.call_me_later;
  if (lower.includes('partner') || lower.includes('wife') || lower.includes('husband') || lower.includes('discuss') || lower.includes('talk to my')) return OBJECTIONS.need_partner;
  if (lower.includes('demo') || lower.includes('test') || lower.includes('try') || lower.includes('hear it')) return OBJECTIONS.need_demo;

  return OBJECTIONS.no_time;
}

function getObjectionContext(text) {
  const obj = getObjectionStrategy(text);
  return `=== 8. OBJECTION STRATEGY ===
Reason: ${obj.reason}
Strategy: ${obj.strategy}
Suggested Counter: "${obj.response}"`;
}

module.exports = {
  OBJECTIONS,
  getObjectionStrategy,
  getObjectionContext
};
