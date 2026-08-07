/* ====================================================================
   USA AI CALLER — MULTI-INDUSTRY SALES & RECEPTION ENGINE
   VERSION: 4.0 — Production Edition
   ====================================================================
   Prompt variants:
   1. getUniversalPitch()  — Cold outbound: AI reveal + automation upsell
   2. getFollowUpPitch()   — Warm follow-up: close after demo
   3. getInboundPitch()    — Inbound receptionist for client lines
   ==================================================================== */

const INDUSTRY_DB = {
  roofing: {
    hook: "your website doesn't have an instant Free Estimate calculator or a storm-damage emergency request form",
    value: "an instant estimate generator that captures high-paying homeowner leads before they call your competitors",
    automationPain: "When a homeowner has a leaking roof at 2 AM, they Google 'emergency roofer near me.' If your phone goes to voicemail, they call the next guy. You lose a $12,000 job.",
    automationValue: "an AI receptionist that answers your phone 24/7, qualifies the lead, gives them an instant estimate range, and books the inspection on your calendar — even while you're on a roof",
    reviewHook: "After every completed roof job, the system automatically texts the homeowner asking for a 5-star Google review. More reviews means you show up higher on Google Maps.",
    missedCallHook: "Every missed call gets an instant text back: 'Hi, this is [Business]. We're on a job site. Is this an emergency? Reply YES and we'll call you back in 10 minutes.'",
    websiteNote: "high-converting roofing sites with storm-damage forms and free estimate calculators"
  },
  plumbing: {
    hook: "there's no 24/7 emergency dispatch form or clear upfront pricing on your online profile",
    value: "a 24/7 emergency dispatch booking system that texts your technicians instantly when a homeowner has a leak",
    automationPain: "Plumbing emergencies don't happen 9 to 5. When someone's basement is flooding at midnight and your phone rings to voicemail, that's a $3,000 emergency call going to your competitor.",
    automationValue: "an AI phone agent that picks up every call, asks diagnostic questions like 'Is there active flooding?', dispatches your on-call tech via text, and confirms the ETA with the homeowner",
    reviewHook: "After every service call, the system sends a review request with one tap to Google. Plumbers with 50+ reviews dominate the local map pack.",
    missedCallHook: "Missed calls get auto-texted: 'Hi from [Business] — we're on a service call. Describe your issue and we'll get back to you within 15 minutes.'",
    websiteNote: "emergency plumbing sites with dispatch forms and clear pricing"
  },
  hvac: {
    hook: "there's no seasonal tune-up scheduler or financing calculator on your page",
    value: "an interactive AC tune-up booking calendar and instant repair quote system",
    automationPain: "Every summer, homeowners panic-search for AC repair. The HVAC company that answers the phone first gets the $5,000 install job. If your phone goes to voicemail in July, you're bleeding money.",
    automationValue: "an AI receptionist that handles AC emergency calls, books tune-ups, and even explains your financing options — so you never miss another summer rush lead",
    reviewHook: "Post-install review automation — every completed HVAC job triggers a 5-star review request 2 hours later.",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Business]. Is your AC emergency? Reply URGENT and our on-call tech will call you back in 10 minutes.'",
    websiteNote: "HVAC sites with seasonal booking and financing calculators"
  },
  dental: {
    hook: "there's no live new-patient appointment booking widget or visual before-and-after smile transformation gallery",
    value: "a 24/7 new-patient scheduling portal and aesthetic smile gallery that builds instant patient trust",
    automationPain: "When a new patient calls your clinic after hours to book a cleaning or cosmetic consultation, and nobody picks up, they just call the next dentist on Google. That's a patient worth $3,000 per year — gone.",
    automationValue: "an AI receptionist that answers calls 24/7, checks your real calendar availability, books the appointment, and sends the patient a confirmation text with pre-visit forms",
    reviewHook: "After every appointment, patients get a friendly text: 'Thanks for visiting! We'd love a quick Google review.' Dental practices with 100+ reviews dominate local search.",
    missedCallHook: "Missed call auto-text: 'Hi from [Clinic]! We're with a patient. Reply BOOK to schedule your appointment or we'll call you back shortly.'",
    websiteNote: "dental practice sites with new-patient booking and smile galleries"
  },
  medspa: {
    hook: "you don't have an interactive treatment menu or a private consultation booking funnel",
    value: "a luxury cinematic consultation funnel and before-and-after aesthetic showcase",
    automationPain: "Med Spa clients are high-value impulse buyers. When they see a Botox ad at 11 PM and call to book, if nobody answers, they've moved on by morning. That's $800 to $2,000 per treatment — lost.",
    automationValue: "an AI concierge that answers after-hours calls with a luxury tone, describes your treatment options, and books private consultations directly into your booking system",
    reviewHook: "Post-treatment review texts drive social proof. 'Your skin is glowing! Share your experience with a quick Google review.'",
    missedCallHook: "Missed call luxury auto-text: 'Thank you for contacting [Spa]. Our aesthetic team will reach out shortly. In the meantime, view our treatment gallery: [link]'",
    websiteNote: "luxury med spa funnels with treatment menus and consultation booking"
  },
  restaurant: {
    hook: "you don't have a fast mobile-optimized menu or zero-commission table reservation system",
    value: "a lightning-fast interactive menu and zero-fee reservation widget that saves you thousands in delivery app commissions",
    automationPain: "Every reservation that goes through a third-party app costs you commission. And when someone calls to book a table for 8 on a Friday night and nobody picks up, they go somewhere else.",
    automationValue: "an AI host that answers the phone, takes reservations, handles special requests like allergies and birthdays, and texts the confirmation — no more third-party fees",
    reviewHook: "After every dining experience, diners get a text: 'Thanks for dining with us! Loved your meal? Leave us a quick review!'",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Restaurant]! We're busy serving guests. Reply RESERVE to book a table or view our menu: [link]'",
    websiteNote: "restaurant sites with zero-fee reservations and mobile menus"
  },
  gym: {
    hook: "I couldn't find a direct link to a modern website with your membership tiers or before-and-after client transformations",
    value: "a cinematic membership funnel and real client transformation showcase",
    automationPain: "When someone Googles 'gyms near me' at midnight after seeing a transformation post, and your website is outdated or your phone goes to voicemail, they sign up with the gym down the street.",
    automationValue: "an AI membership advisor that answers calls 24/7, explains your pricing tiers, books free trial sessions, and follows up with a text containing your transformation gallery",
    reviewHook: "After every milestone (30 days, 90 days), members get an automated text: 'Congrats on your progress! Share your journey with a Google review!'",
    missedCallHook: "Missed call auto-text: 'Hey! Thanks for reaching out to [Gym]. Want to book a FREE trial session? Reply YES and we'll set it up!'",
    websiteNote: "3D interactive gym membership funnels and transformation galleries"
  },
  lawyer: {
    hook: "your firm's website has no confidential case evaluation form or instant callback scheduling",
    value: "a 24/7 confidential intake portal and automated case screening system",
    automationPain: "When someone gets arrested at 2 AM or gets served divorce papers on a Sunday, they need a lawyer NOW. If your firm doesn't answer, the next attorney on Google gets that $5,000 retainer.",
    automationValue: "an AI legal intake agent that answers emergency calls, performs basic case screening, captures sensitive details securely, and schedules an attorney callback within the hour",
    reviewHook: "Post-case-resolution review request: 'Thank you for trusting [Firm]. If we exceeded your expectations, a Google review helps others find trusted legal help.'",
    missedCallHook: "Missed call auto-text: 'Thank you for contacting [Law Firm]. Your inquiry is important. Reply URGENT for priority callback or we'll reach out within 1 business hour.'",
    websiteNote: "law firm intake portals with confidential case evaluation forms"
  },
  realestate: {
    hook: "your listings don't have interactive virtual tours or an AI-powered property matching quiz",
    value: "a cinematic property showcase with virtual tours and instant lead-capture for serious buyers",
    automationPain: "Buyers browse listings at night. When they call about a $500,000 property and get voicemail, they call the next agent. That's a $15,000 commission — gone.",
    automationValue: "an AI showing coordinator that answers buyer calls, asks qualifying questions (budget, timeline, neighborhood), and books property tours directly on your calendar",
    reviewHook: "After every closing, clients get: 'Congratulations on your new home! A Google review helps other families find a great agent.'",
    missedCallHook: "Missed call auto-text: 'Hi! Thanks for your interest. Reply with your budget range and preferred area, and I'll send matching listings right away.'",
    websiteNote: "real estate showcases with virtual tours and buyer matching"
  },
  salon: {
    hook: "there's no real-time appointment booking or stylist portfolio gallery on your page",
    value: "an Instagram-worthy stylist portfolio and 24/7 online booking system",
    automationPain: "When a client wants to book a cut-and-color at 10 PM and can't book online, they'll find a salon that lets them. That's $150 to $400 per visit, recurring monthly.",
    automationValue: "an AI booking assistant that takes calls, checks your stylists' real-time availability, books the appointment, and sends a confirmation with pre-visit instructions",
    reviewHook: "Post-appointment text: 'Love your new look? Share it with a Google review and tag us on Instagram!'",
    missedCallHook: "Missed call auto-text: 'Hey gorgeous! We're with a client right now. Reply BOOK to schedule your next appointment or we'll call you back soon!'",
    websiteNote: "salon portfolio sites with real-time stylist booking"
  },
  auto: {
    hook: "your shop has no online appointment scheduler or real-time service status tracker",
    value: "a service booking portal with real-time repair status updates that builds customer trust and loyalty",
    automationPain: "Car owners hate calling and getting voicemail when they need an oil change or brake check. They'll just drive to the next shop.",
    automationValue: "an AI service advisor that answers calls, books service appointments, sends repair status updates via text, and even handles basic questions like 'How much does a brake job cost?'",
    reviewHook: "Post-service text: 'Thanks for trusting [Shop] with your vehicle! A quick Google review helps other car owners find reliable service.'",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Auto Shop]. Reply BOOK to schedule your service or describe your car issue and we'll text you back with an estimate.'",
    websiteNote: "auto shop portals with service booking and live repair status"
  },
  chiropractor: {
    hook: "your clinic has no online intake form or same-day appointment booking flow",
    value: "a seamless patient intake funnel and same-day scheduling system that turns more web traffic into booked visits",
    automationPain: "Pain patients are urgent and impatient. If they call after hours and get voicemail, they often book the next chiropractic clinic they find online.",
    automationValue: "an AI intake assistant that answers calls 24/7, captures patient symptoms, confirms insurance basics, and books a same-day visit into your calendar",
    reviewHook: "After each visit, patients receive a quick review request asking for a Google rating and treatment experience feedback.",
    missedCallHook: "Missed call auto-text: 'Hi, this is [Clinic]. We missed your call. Reply BOOK for same-day availability or leave your pain concern and we'll call you back shortly.'",
    websiteNote: "chiropractic clinic sites with intake forms and appointment scheduling"
  },
  pestcontrol: {
    hook: "your website does not offer a fast emergency pest quote form or after-hours callback capture",
    value: "a high-converting pest quote funnel that captures urgent infestations before competitors do",
    automationPain: "Pest urgency is immediate. When a homeowner calls at night and only hears voicemail, they book whoever answers first — usually the local competitor.",
    automationValue: "an AI phone agent that handles urgent pest calls, asks severity questions, and sends a callback or quote request to your dispatch team",
    reviewHook: "After every service visit, the system sends a simple Google review request that helps rank your pest control business higher locally.",
    missedCallHook: "Missed call auto-text: 'Hi from [Business]. We missed your call. Reply PEST to request a callback or describe the issue and we'll get back to you right away.'",
    websiteNote: "pest control sites with emergency quote forms and fast local booking"
  },
  landscaping: {
    hook: "you don't have a quote form for mulch, mowing, or landscaping projects on your site",
    value: "an instant estimate and quote request engine that turns website visitors into booked estimates",
    automationPain: "Seasonal lead demand spikes hard. If a homeowner needs a quote on a Saturday afternoon and your phone goes to voicemail, they book the next landscaper.",
    automationValue: "an AI estimator that asks about service type, property size, and urgency, then books a quote or callback automatically",
    reviewHook: "After each completed project, the system sends a review request prompting homeowners to share before-and-after results.",
    missedCallHook: "Missed call auto-text: 'Hi, thanks for contacting [Business]. Reply QUOTE and we'll send your estimate request to our team immediately.'",
    websiteNote: "landscaping sites with quote forms and before-and-after portfolio pages"
  },
  pressurewashing: {
    hook: "your current page does not capture urgent pressure-washing requests or drive-ready service booking",
    value: "a quick quote and scheduling funnel that converts local demand into booked jobs",
    automationPain: "Homeowners often need exterior cleaning the same day. If they call and hear voicemail, they call a competitor who answers right away.",
    automationValue: "an AI receptionist that collects job details, service area, and urgency, then confirms a booking slot with your team",
    reviewHook: "After each completed clean, a review text helps build local trust and more map visibility.",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Business]. Reply CLEAN to get a callback or ask about your exterior cleaning quote.'",
    websiteNote: "pressure washing sites with quote forms and service area pages"
  },
  painting: {
    hook: "you have no online estimate request form or room-by-room project consultation funnel",
    value: "a polished estimate and consultation funnel that converts homeowners into painting leads faster",
    automationPain: "Painting projects are often impulse buys driven by curb appeal and seasonal demand. If your phone misses that call, the next painter wins.",
    automationValue: "an AI estimator that asks about the service, property type, and urgency, then captures the lead and routes it to your calendar",
    reviewHook: "After each job, clients receive an automated review request with a one-tap Google review link.",
    missedCallHook: "Missed call auto-text: 'Hi from [Business]. Thanks for reaching out. Reply PAINT and we'll get your estimate request moving right away.'",
    websiteNote: "painting company sites with estimate request pages and portfolio galleries"
  },
  cleaningservices: {
    hook: "your business lacks an instant quote form or same-day service booking experience",
    value: "a fast cleaning estimate and booking funnel that captures recurring monthly service demand",
    automationPain: "Cleaning businesses thrive on repeatable recurring appointments. If callers don't get an answer instantly, they hire whoever responds first.",
    automationValue: "an AI booking assistant that qualifies the cleaning job, asks for square footage and frequency, and books the appointment automatically",
    reviewHook: "After each clean, a review request helps you rank higher in local service searches.",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Business]. Reply CLEAN for a quick callback or book your cleaning service online now.'",
    websiteNote: "cleaning service sites with recurring booking and instant quote funnels"
  },
  insuranceagency: {
    hook: "your agency is missing an instant quote request funnel or policy comparison booking experience",
    value: "a trusted quote capture experience that turns insurance shoppers into booked consultations",
    automationPain: "Insurance shoppers compare agents in minutes. If they call after hours and get voicemail, the next agency gets the lead and the commission.",
    automationValue: "an AI insurance intake assistant that answers urgent policy questions, captures the quote request, and schedules a callback with the right advisor",
    reviewHook: "After each consultation, the system sends a review request and referral prompt to reinforce trust.",
    missedCallHook: "Missed call auto-text: 'Hi from [Agency]. We missed your call. Reply QUOTE and we'll get back to you with the right coverage options.'",
    websiteNote: "insurance agency sites with quote funnels and quote request booking"
  },
  mortgagebroker: {
    hook: "your website has no fast rate comparison or pre-approval intake funnel",
    value: "a mortgage lead capture system that funnels high-intent buyers straight into a callback queue",
    automationPain: "When a buyer is shopping rates at 9 PM and nobody answers, that lead is lost before morning. Mortgage volume is all about speed.",
    automationValue: "an AI mortgage intake assistant that captures buyer details, funding goals, and timeline, then routes them to the right loan officer",
    reviewHook: "After each successful close, clients receive a review and referral prompt to strengthen your local reputation.",
    missedCallHook: "Missed call auto-text: 'Thanks for reaching out to [Broker]. Reply RATE and we'll have a mortgage expert call you back shortly.'",
    websiteNote: "mortgage broker sites with rate comparison and approval request funnels"
  },
  accounting: {
    hook: "your firm has no quick consultation booking flow or tax appointment scheduler on the site",
    value: "a polished client intake and scheduling funnel that captures more tax and financial consultation leads",
    automationPain: "Tax and accounting deadlines are unforgiving. If a client needs help after business hours and nobody answers, they move to the next firm fast.",
    automationValue: "an AI intake assistant that captures service needs, urgency, and callback preferences, then schedules a consultation directly on your calendar",
    reviewHook: "After each appointment, a quick review request helps build trust and local SEO authority.",
    missedCallHook: "Missed call auto-text: 'Hi, this is [Firm]. We missed your call. Reply TAX or BOOK and we’ll reach out with your next appointment options.'",
    websiteNote: "accounting and CPA sites with consultation booking and secure intake forms"
  },
  default: {
    hook: "your online presence is currently missing a lead-capture system",
    value: "a modern, high-converting digital storefront designed specifically to capture high-paying clients 24/7",
    automationPain: "Every missed call is a missed sale. Studies show 85% of people who call and don't get an answer will never call back — they call your competitor instead.",
    automationValue: "an AI receptionist that answers every call, qualifies leads, books appointments, and follows up via text — so you never lose another customer to voicemail",
    reviewHook: "After every completed service, the system automatically texts your customer asking for a 5-star Google review.",
    missedCallHook: "Every missed call gets an instant auto-text: 'Hi! We missed your call. Reply with your name and we'll get back to you ASAP.'",
    websiteNote: "high-converting business websites with lead capture and booking"
  }
};

/**
 * Normalize industry key for DB lookup.
 */
function resolveIndustry(industry = 'local business') {
  const key = String(industry || 'default').toLowerCase().trim().replace(/\s+/g, '');
  const aliases = {
    'real-estate': 'realestate',
    'real_estate': 'realestate',
    'law': 'lawyer',
    'attorney': 'lawyer',
    'legal': 'lawyer',
    'auto_shop': 'auto',
    'autoshop': 'auto',
    'mechanic': 'auto',
    'med-spa': 'medspa',
    'med_spa': 'medspa',
    'spa': 'medspa',
    'fitness': 'gym',
    'dentist': 'dental',
    'roofer': 'roofing',
    'plumber': 'plumbing',
    'chiropractor': 'chiropractor',
    'chiro': 'chiropractor',
    'pestcontrol': 'pestcontrol',
    'pest-control': 'pestcontrol',
    'landscaper': 'landscaping',
    'landscaping': 'landscaping',
    'pressurewashing': 'pressurewashing',
    'pressure-washing': 'pressurewashing',
    'painting': 'painting',
    'cleaning': 'cleaningservices',
    'cleaningservices': 'cleaningservices',
    'insurance': 'insuranceagency',
    'insuranceagency': 'insuranceagency',
    'mortgage': 'mortgagebroker',
    'mortgagebroker': 'mortgagebroker',
    'accounting': 'accounting',
    'cpa': 'accounting',
    'tax': 'accounting'
  };
  const resolved = aliases[key] || key;
  return INDUSTRY_DB[resolved] ? resolved : 'default';
}

/**
 * Cold outbound pitch v4.0 — Natural, non-scripted AI sales consultant.
 */
function getUniversalPitch({
  clientName = 'your business',
  industry = 'local business',
  weakness = 'no 24/7 AI phone answering or missed-call recovery system',
  demoUrl = 'https://sass-ashen.vercel.app/',
  agentName = 'Sarah',
  companyName = 'ZeroRefer Studio',
  city = 'Austin, Texas',
  monthlyPrice = 297,
  websitePrice = 1500
} = {}) {
  const displayIndustry = industry || 'local business';

  return `You are ${agentName}, an intelligent, articulate, and human-sounding sales consultant calling from ${companyName} in ${city}.

LEGAL MANDATE — AI DISCLOSURE:
You MUST state clearly in your VERY FIRST sentence that you are an AI assistant.

TONE & VOICE DIRECTION — SOUND LIKE A REAL HUMAN ADVISOR:
1. Speak in a natural, warm, conversational tone — like a friendly business advisor, NOT a telemarketer reading a script.
2. CRITICAL SPEED RULE: Keep every response under 30 words (2 to 3 short sentences max). Brevity keeps the call feeling snappy, not scripted.
3. Listen carefully to what the prospect says and respond DIRECTLY to their actual question before steering the conversation.
4. NEVER repeat the exact same phrase or sentence you've already used in this call. Always paraphrase naturally.
5. NEVER read web URLs, bracket codes, or technical jargon aloud. Say "I'll text it over" instead.
6. Use natural conversational fillers sparingly — "Yeah!", "Totally!", "Makes sense!", "Got it!" — but vary them each turn.

IMPORTANT: The example responses below are TONE REFERENCES ONLY.
Never repeat them word-for-word. Always generate a fresh, natural paraphrase that fits the specific conversation context. Sound human, not scripted.

PROSPECT & BUSINESS CONTEXT:
- Target Business: ${clientName}
- Industry: ${displayIndustry}
- Pricing: AI Assistant is $${monthlyPrice}/month (no contract). Custom website build is $${websitePrice}.
- Demo Link: ${demoUrl}

CONVERSATION & OBJECTION HANDLING (TONE REFERENCES — PARAPHRASE, DON'T COPY):

1. IF THEY SAY YES / ASK "WHY ARE YOU CALLING?":
   Reference tone: "We help ${displayIndustry} businesses stop losing calls to voicemail. Mind if I send you a quick demo?"

2. IF THEY ASK "WHERE DID YOU GET MY NUMBER?":
   Reference tone: "Found your business profile online while researching local ${displayIndustry} companies."

3. IF THEY ASK "WHAT DO YOU DO / HOW DOES IT HELP ME?":
   Reference tone: "We set up an AI phone agent that answers your calls 24/7, qualifies leads, and books appointments."

4. IF THEY SAY "CAN YOU EXPLAIN MORE / WHAT DO YOU MEAN?":
   Reference tone: "When you miss a call or you're busy, our AI answers instantly and captures that lead for you."

5. IF THEY AGREE TO THE DEMO / SAY SURE / ASK FOR LINK / ASK FOR PORTFOLIO:
   Reference tone: "Awesome! Texting you the demo link right now — check your phone! [SEND_DEMO_SMS]"

6. IF THEY ASK ABOUT COST / PRICING:
   Reference tone: "The demo is free. Full 24/7 AI setup runs $${monthlyPrice} a month, no contract needed."

7. IF THEY ARE CONFUSED / SAY "YOU ARE NOT MAKING SENSE":
   Reference tone: "Simply put — our AI answers your business phone when you can't. Want me to text you a preview?"

8. IF THEY ASK "WHAT NEXT?" AFTER SMS:
   Reference tone: "Just texted the demo! Check it out when you're free, and reply if you have questions. Have a great day!"

9. IF THEY SAY "NOT INTERESTED / DON'T CALL ME":
   Reference tone: "No worries at all! Thanks for your time. Have a great day! [DO_NOT_CALL]"

ANTI-REPETITION RULES:
- Track what you've said. If you already explained what the AI does, don't explain it again — move the conversation forward.
- If the prospect asks the same question twice, give a DIFFERENT angle or example, not the same answer.
- If you already offered the demo link, don't offer it again. Instead ask a follow-up question or address their concern.

WHAT NOT TO OFFER:
- Do NOT promise to send "contact details", "contact information", or "general info". You can ONLY offer to send the demo or portfolio link.
- Do NOT make up services, features, or prices that aren't listed above.

ACTION EMIT CODES:
- Emit "[SEND_DEMO_SMS]" when they agree to see the demo, or show interest in pricing/features. Place it at the very end.
- Emit "[DO_NOT_CALL]" ONLY ONCE if the prospect asks not to be called. Place it at the very end.
- Never emit any code more than once.`;
}

/**
 * Warm follow-up — close after demo view.
 */
function getFollowUpPitch({
  clientName = 'your business',
  industry = 'local business',
  demoUrl = 'https://sass-ashen.vercel.app/',
  agentName = 'Sarah',
  companyName = 'ZeroRefer Studio',
  monthlyPrice = 297,
  websitePrice = 1500,
  holdHours = 48
} = {}) {
  const displayIndustry = industry || 'local business';

  return `You are ${agentName}, a professional sales consultant calling from ${companyName}. You are making a FOLLOW-UP call to ${clientName}, a ${displayIndustry} business owner who previously received a demo link.

TONE & VOICE DIRECTION — SOUND HUMAN:
1. Speak in a warm, confident, conversational tone like a trusted business advisor.
2. CRITICAL SPEED RULE: Keep every response strictly under 20 words (1 to 2 short sentences max). NEVER monologue.
3. Listen attentively and address their questions directly before guiding them toward a decision.
4. NEVER read web URLs or bracket code tags out loud.

PROSPECT CONTEXT:
- Business Name: ${clientName}
- Industry: ${displayIndustry}
- Demo URL: ${demoUrl}
- Pricing: Full AI Receptionist is $${monthlyPrice}/month (no contract). Website build is $${websitePrice}.

CONVERSATION FLOW & CLOSING GUIDE (EVERY EXAMPLE UNDER 20 WORDS):

1. OPENING:
   "Hi! This is ${agentName} from ${companyName}. I texted over the AI phone demo for ${clientName} — did you check it out?"

2A. IF THEY SAW THE DEMO:
   "Awesome! What did you think? Full 24/7 setup is $${monthlyPrice} a month with no contract. Want to get started this week?"

2B. IF THEY HAVEN'T LOOKED YET:
   "Got it! The 60-second demo link is in your texts. It shows how to stop losing missed calls to competitors."

3. EXCLUSIVITY & CLOSING INCENTIVE:
   "Makes sense! We only work with one ${displayIndustry} company per area for exclusivity. Want me to text the checkout link?"

4. IF THEY AGREE TO BUY / ASK FOR PAYMENT LINK:
   "Fantastic! I'm texting your checkout link and quick onboarding form right now. [SEND_PAYMENT]"

5. IF THEY NEED MORE TIME:
   "Fair enough! I can hold your area's exclusive slot for ${holdHours} hours so you can review it. Fair enough?"

6. IF THEY DECLINE / DO NOT CALL:
   "Appreciate your time! Have a fantastic day. [DO_NOT_CALL]"

ACTION EMIT CODES:
- Emit "[SEND_PAYMENT]" when they agree to start or request the payment link.
- Emit "[SEND_PRICING]" if they ask for a breakdown text.
- Emit "[DEAL_CLOSED]" if they confirm a purchase.
- Emit "[DO_NOT_CALL]" if they refuse or request no further calls.`;
}

/**
 * Inbound AI receptionist for a client's business line.
 */
function getInboundPitch({
  clientName = 'the business',
  industry = 'local business',
  ownerName = 'the owner',
  services = [],
  businessHours = '9 AM to 5 PM, Monday through Friday',
  bookingUrl = '',
  emergencyProtocol = 'text the owner immediately',
  pricingNotes = '',
  customInstructions = '',
  discloseAsAi = false
} = {}) {
  const serviceList = Array.isArray(services) && services.length > 0
    ? services.join(', ')
    : `standard ${industry} services`;

  return `You are an AI receptionist for ${clientName}, a ${industry} business. You sound professional, warm, articulate, and helpful.

TONE & VOICE DIRECTION:
1. Speak in a natural, polite, and helpful customer service voice.
2. CRITICAL SPEED RULE: Keep every response strictly under 22 words (1 to 2 short sentences max).
3. Listen carefully to the caller's request and respond directly with clear information.
4. NEVER read emit codes or URLs aloud.

BUSINESS DETAILS:
- Business Name: ${clientName}
- Industry: ${industry}
- Owner: ${ownerName}
- Services: ${serviceList}
- Hours: ${businessHours}
- Emergency Protocol: ${emergencyProtocol}
${bookingUrl ? `- Booking Link: ${bookingUrl}` : ''}
${pricingNotes ? `- Pricing Information: ${pricingNotes}` : ''}
${customInstructions ? `- Special Instructions: ${customInstructions}` : ''}

CALL HANDLING GUIDE (EVERY EXAMPLE UNDER 22 WORDS):

1. GREETING:
   "Thank you for calling ${clientName}! ${discloseAsAi ? 'This is the AI assistant.' : 'This is the virtual assistant.'} How can I help you today?"

2. APPOINTMENTS & BOOKING:
   "Got it! What day and time works best for you? I'll text you a instant booking confirmation. [BOOK_APPOINTMENT]"

3. URGENT / EMERGENCY DISPATCH:
   "I understand this is urgent! I'm notifying our on-call team right now to reach out immediately. [EMERGENCY_DISPATCH]"

4. PRICING & QUOTES:
   "Got it! I've logged your request for our team to text you a custom quote right away. [CAPTURE_LEAD]"

5. GENERAL INQUIRIES & HOURS:
   "Our hours are ${businessHours}. Would you like me to take a message for a callback?"

ACTION EMIT CODES:
- "[BOOK_APPOINTMENT]" — appointment confirmed
- "[CAPTURE_LEAD]" — customer info logged for callback
- "[EMERGENCY_DISPATCH]" — urgent emergency notification
- "[SEND_FOLLOWUP_TEXT]" — sending confirmation text`;
}

module.exports = {
  getUniversalPitch,
  getFollowUpPitch,
  getInboundPitch,
  resolveIndustry,
  INDUSTRY_DB
};

