/* ====================================================================
   USA AI CALLER — MULTI-INDUSTRY SALES & RECEPTION ENGINE
   VERSION: 5.0 — Modular Prompt Architecture
   ==================================================================== */

const promptEngine = require('../prompts');

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
    automationValue: "an AI receptionist that takes table reservations, answers menu questions, and handles catering inquiries — with zero monthly commission",
    reviewHook: "Automated dining review texts — guests get a friendly text 1 hour after their reservation.",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Restaurant]! View our menu or reserve a table: [link]'",
    websiteNote: "restaurant sites with mobile menus and direct reservation widgets"
  },
  gym: {
    hook: "there's no online class schedule or instant membership signup funnel on your profile",
    value: "a 24/7 membership inquiry system that books trial classes and captures fitness leads automatically",
    automationPain: "When someone searches 'gym near me' at 10 PM and calls to ask about classes, if nobody answers, they sign up with your competitor down the street.",
    automationValue: "an AI receptionist that answers every call, explains your membership options, class schedule, and books free trials instantly",
    reviewHook: "After new member signup, the system sends a review request: 'Loving your workouts? Share a quick Google review!'",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Gym]! Check our class schedule and grab a free trial: [link]'",
    websiteNote: "fitness sites with class schedules and membership signup funnels"
  },
  salon: {
    hook: "there's no instant appointment booking or service menu showcase on your online presence",
    value: "an automated appointment booking system that captures walk-in and call-in clients when your stylists are busy",
    automationPain: "Your best stylists are hands-deep in a color treatment — they can't answer the phone. That new client books with the salon that picks up.",
    automationValue: "an AI receptionist that books appointments, checks stylist availability, describes your services, and sends confirmation texts",
    reviewHook: "Post-appointment review texts: 'Love your new look? Share a quick Google review and get 10% off your next visit!'",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Salon]! Book your next appointment online: [link]'",
    websiteNote: "salon sites with booking widgets and service galleries"
  },
  construction: {
    hook: "there's no project inquiry form or portfolio showcase driving estimate requests",
    value: "an automated lead capture system that qualifies construction projects and schedules estimates while you're on the job site",
    automationPain: "You're on a scaffold or operating heavy equipment — you physically can't answer your phone. That $50K renovation inquiry goes to your competitor.",
    automationValue: "an AI receptionist that captures project details, qualifies budget and timeline, and schedules in-person estimates — even when you're on-site",
    reviewHook: "Post-project review automation — homeowners get a friendly text after project completion.",
    missedCallHook: "Missed call auto-text: 'Thanks for reaching out to [Company]! Describe your project and we'll send a free estimate: [link]'",
    websiteNote: "contractor sites with project portfolios and estimate request forms"
  },
  veterinary: {
    hook: "there's no emergency triage system or online appointment booking for pet owners",
    value: "a 24/7 pet emergency triage and appointment booking system that prioritizes urgent cases automatically",
    automationPain: "A pet owner at midnight with a sick puppy calls 3 vets. The first clinic that answers gets a $2,500 emergency surgery case.",
    automationValue: "an AI receptionist that triages pet emergencies, asks symptom questions, dispatches on-call vets for urgent cases, and books routine appointments",
    reviewHook: "Post-visit review texts: 'Glad [Pet Name] is feeling better! A quick Google review helps other pet parents find us.'",
    missedCallHook: "Missed call auto-text: 'Thanks for calling [Clinic]! Is this a pet emergency? Reply URGENT for immediate callback.'",
    websiteNote: "vet clinic sites with emergency info and appointment booking"
  },
  ecommerce: {
    hook: "there's no live customer support or cart recovery system reducing your 70% abandonment rate",
    value: "an AI customer service agent that answers product questions, processes returns, and recovers abandoned carts by phone",
    automationPain: "A customer has a $150 cart but has a sizing question. If nobody answers, they abandon the cart. 70% of online carts are abandoned.",
    automationValue: "an AI phone agent that answers product questions instantly, helps with sizing, processes returns, and calls back cart abandoners to close the sale",
    reviewHook: "Post-purchase review automation: 'Loving your new [Product]? Leave a quick review and get 10% off your next order!'",
    missedCallHook: "Missed call auto-text: 'Thanks for reaching out! Browse our store or track your order here: [link]'",
    websiteNote: "ecommerce sites with live support and cart recovery funnels"
  }
};

function resolveIndustry(rawIndustry = '') {
  const norm = String(rawIndustry).toLowerCase().trim();
  if (norm.includes('roof')) return { key: 'roofing', data: INDUSTRY_DB.roofing };
  if (norm.includes('plumb')) return { key: 'plumbing', data: INDUSTRY_DB.plumbing };
  if (norm.includes('hvac') || norm.includes('air') || norm.includes('heat')) return { key: 'hvac', data: INDUSTRY_DB.hvac };
  if (norm.includes('dent')) return { key: 'dental', data: INDUSTRY_DB.dental };
  if (norm.includes('spa') || norm.includes('botox') || norm.includes('aesthetic')) return { key: 'medspa', data: INDUSTRY_DB.medspa };
  if (norm.includes('rest') || norm.includes('food') || norm.includes('diner')) return { key: 'restaurant', data: INDUSTRY_DB.restaurant };
  if (norm.includes('gym') || norm.includes('fitness') || norm.includes('yoga')) return { key: 'gym', data: INDUSTRY_DB.gym };
  if (norm.includes('salon') || norm.includes('barber') || norm.includes('hair')) return { key: 'salon', data: INDUSTRY_DB.salon };
  if (norm.includes('construct') || norm.includes('contractor') || norm.includes('remodel')) return { key: 'construction', data: INDUSTRY_DB.construction };
  if (norm.includes('vet') || norm.includes('animal') || norm.includes('pet')) return { key: 'veterinary', data: INDUSTRY_DB.veterinary };
  if (norm.includes('ecommerce') || norm.includes('retail') || norm.includes('shop')) return { key: 'ecommerce', data: INDUSTRY_DB.ecommerce };
  return { key: 'roofing', data: INDUSTRY_DB.roofing };
}

function getUniversalPitch(lead = {}, userSpeech = '') {
  return promptEngine.buildPrompt(lead, userSpeech);
}

function getFollowUpPitch(lead = {}, userSpeech = '') {
  return promptEngine.buildPrompt({ ...lead, stage: 'followup' }, userSpeech);
}

function getInboundPitch(receptionistData = {}) {
  const {
    clientName = 'our business',
    industry = 'general business',
    ownerName = 'the team',
    services = [],
    businessHours = 'Mon-Fri 9 AM - 5 PM',
    emergencyProtocol = 'call emergency number',
    bookingUrl = '',
    pricingNotes = '',
    customInstructions = '',
    discloseAsAi = false
  } = receptionistData;

  const serviceList = Array.isArray(services) && services.length > 0
    ? services.join(', ')
    : `standard ${industry} services`;

  return `You are an AI receptionist for ${clientName}, a ${industry} business. You sound professional, warm, articulate, and helpful.

TONE & VOICE DIRECTION:
1. Speak in a natural, polite, and helpful customer service voice.
2. CRITICAL SPEED RULE: Keep every response strictly under 35 words (1 to 2 short sentences max).
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

CALL HANDLING GUIDE:
1. GREETING:
   "Thank you for calling ${clientName}! ${discloseAsAi ? 'This is the AI assistant.' : 'This is the virtual assistant.'} How can I help you today?"

2. APPOINTMENTS & BOOKING:
   "Got it! What day and time works best for you? I'll book it directly into Google Calendar for you. [ACTION:BOOK_APPOINTMENT]"

3. URGENT / EMERGENCY DISPATCH:
   "I understand this is urgent! I'm notifying our on-call team right now to reach out immediately. [ACTION:EMERGENCY_DISPATCH]"

4. PRICING & QUOTES:
   "Got it! I've logged your request for our team to text you a custom quote right away. [ACTION:SEND_DEMO_SMS]"

ACTION EMIT CODES:
- "[ACTION:BOOK_APPOINTMENT]" — appointment confirmed
- "[ACTION:SEND_DEMO_SMS]" — customer info logged for demo text
- "[ACTION:SEND_INVOICE]" — sending checkout link`;
}

function getSystemPrompt(lead = {}) {
  if (lead.callType === 'inbound' || lead.callType === 'inbound-receptionist') {
    return getInboundPitch(lead);
  }
  return getUniversalPitch(lead);
}

module.exports = {
  getUniversalPitch,
  getFollowUpPitch,
  getInboundPitch,
  getSystemPrompt,
  resolveIndustry,
  INDUSTRY_DB,

  // Prompt Engine Export Pass-throughs
  buildPrompt: promptEngine.buildPrompt,
  chooseThinking: promptEngine.chooseThinking,
  detectIntent: promptEngine.detectIntent,
  detectEmotion: promptEngine.detectEmotion,
  getObjectionStrategy: promptEngine.getObjectionStrategy,
  getIndustryInfo: promptEngine.getIndustryInfo
};
