/**
 * PROMPT MODULE 7: INDUSTRY INTELLIGENCE
 * Deep domain knowledge with painPoints, faq, objections, closing, roi, benefits, keywords.
 * Covers: roofing, dental, plumbing, hvac, legal, realestate, medspa, restaurant, insurance, auto, landscaping, gym
 */

const INDUSTRIES = {
  roofing: {
    name: 'Roofing & Storm Repair',
    painPoints: 'Missed emergency storm call leads after 5 PM go directly to competitors. Homeowners searching at 2 AM for leaking roofs call 3 roofers — the first to answer wins the $12K job.',
    roi: 'Single commercial roof replacement lead is worth $8,000–$25,000. One saved call per month covers a full year of AI service.',
    hook: 'Storm calls happen at night. If your phone goes to voicemail, homeowners call the next contractor on Google.',
    faq: 'Can Sarah dispatch emergency crews? Yes — instant SMS alerts to on-call roofers with caller details.',
    objections: 'Most roofers think they never miss calls. Ask: "How many calls went to voicemail last month?" — average is 15–30%.',
    closing: 'So if Sarah catches just 1 extra storm lead per month, that\'s $12K in revenue for $297/mo. Want to set up a quick 5-minute demo?',
    benefits: '24/7 emergency answer, instant SMS dispatch to crew, automated Google review requests after every completed job.',
    keywords: ['storm damage', 'roof leak', 'emergency roofer', 'hail damage', 'shingle repair', 'insurance claim roof']
  },
  dental: {
    name: 'Dental Practices & Orthodontics',
    painPoints: 'Front desk staff overwhelmed with scheduling calls while attending patients in-office. New patient calls after 5 PM go unanswered — they call the next dentist on Google.',
    roi: 'Average patient lifetime value is $1,200+. Missed new patient call = $1,200/year gone. 10 missed calls/month = $12,000/year lost.',
    hook: 'When your front desk is busy with patients, missed calls cost thousands in lost appointments.',
    faq: 'Does Sarah integrate with scheduling? Yes — books directly into Google Calendar and sends patient confirmation texts with pre-visit forms.',
    objections: 'Dentists often say "my receptionist handles it." Ask: "What happens after 5 PM or during lunch when she\'s away?"',
    closing: 'If Sarah saves just 2 new patients per month, that\'s $2,400/year in revenue. Setup takes 60 seconds — want to try it?',
    benefits: '24/7 new patient booking, automated appointment reminders, post-visit Google review requests, missed call text-back.',
    keywords: ['dental appointment', 'teeth cleaning', 'cosmetic dentistry', 'orthodontist', 'new patient', 'emergency dental']
  },
  plumbing: {
    name: 'Plumbing & Emergency Services',
    painPoints: 'Burst pipe calls at 2 AM missed because owner is sleeping. Flooding basements need immediate response — callers try 3 plumbers and go with whoever picks up first.',
    roi: 'Emergency plumbing jobs average $500–$3,500 each. One after-hours emergency job covers 6+ months of AI service.',
    hook: 'When pipes burst at midnight, callers need an answer right then. Sarah handles 100% of night calls and dispatches your on-call tech.',
    faq: 'Can Sarah handle price quotes? She provides instant ballpark quotes, asks diagnostic questions, and dispatches your on-call tech via SMS.',
    objections: 'Plumbers often say "I keep my phone on." Ask: "What about when you\'re under a sink on another job?"',
    closing: 'One $2,000 emergency call at 2 AM that Sarah catches pays for the entire year. Want to see how it works?',
    benefits: '24/7 emergency dispatch, diagnostic intake questions, instant tech SMS alerts, automated review requests.',
    keywords: ['emergency plumber', 'burst pipe', 'water heater', 'drain cleaning', 'sewer line', 'flooding']
  },
  hvac: {
    name: 'HVAC & Climate Control',
    painPoints: 'Peak heatwaves/cold snaps cause 200+ call spikes that overflow front office lines. Summer AC breakdown calls at 9 PM — $5,000 install jobs lost to competitors.',
    roi: 'New AC unit installation is worth $4,500–$12,000. One captured emergency call in July pays for 2+ years of AI.',
    hook: 'During summer heatwaves, every missed call goes to another HVAC company. Sarah answers every single one.',
    faq: 'Can Sarah filter urgent AC repair calls? Yes — prioritizes emergency heat/cooling breakdowns and routes them to on-call techs.',
    objections: 'HVAC owners say "it\'s seasonal." Response: "That\'s exactly why — your busiest months are when you miss the most calls."',
    closing: 'If Sarah catches just 1 AC install lead during summer rush, that\'s $6,000+ in revenue. Worth a quick demo?',
    benefits: 'Seasonal surge handling, financing option explanations, emergency dispatch, tune-up booking automation.',
    keywords: ['AC repair', 'heating', 'furnace', 'air conditioning', 'HVAC installation', 'ductwork']
  },
  legal: {
    name: 'Law Firms & Personal Injury',
    painPoints: 'Accident victims call 5 lawyers — first firm to answer the phone gets the retainer. After-hours intake calls worth $10K–$50K lost to voicemail.',
    roi: 'Average personal injury retainer case value is $10,000–$50,000+. One captured case pays for years of AI service.',
    hook: 'In legal intake, speed to respond is everything. Sarah completes 60-second client intake 24/7 — no more lost retainers.',
    faq: 'Is Sarah confidential? Absolutely — attorney-client intake protocols maintained. No data shared externally.',
    objections: 'Lawyers say "we have a receptionist." Ask: "What about weekends and after 6 PM when 40% of accident calls happen?"',
    closing: 'One $25K personal injury case that Sarah captures pays for the AI for 7 years. Want to see the intake flow?',
    benefits: '24/7 legal intake, case type pre-qualification, conflict check questions, appointment scheduling with attorneys.',
    keywords: ['personal injury', 'car accident', 'workers comp', 'slip and fall', 'legal consultation', 'attorney']
  },
  realestate: {
    name: 'Real Estate & Property Management',
    painPoints: 'Realtors in showings miss buyer calls on hot property listings. In a competitive market, 30 minutes of delay = lost buyer.',
    roi: 'Single listing deal commission is $9,000–$30,000. One captured buyer lead during a showing pays for 5+ years.',
    hook: 'While you are presenting to a client, Sarah answers buyer inquiries, texts property links, and schedules open house tours.',
    faq: 'Can she text property links? Yes — instant property tour links, virtual walkthrough videos, and open house schedules.',
    objections: 'Agents say "I call them back quickly." Ask: "But what if the buyer already booked a showing with another agent?"',
    closing: 'One buyer lead Sarah captures while you\'re at a showing — that\'s a $15K+ commission. Want to try?',
    benefits: 'Buyer inquiry handling, property link texting, showing scheduling, lead qualification, market area info.',
    keywords: ['homes for sale', 'real estate agent', 'property listing', 'open house', 'mortgage', 'buyer inquiry']
  },
  medspa: {
    name: 'Med Spa & Aesthetic Clinics',
    painPoints: 'High-value impulse buyers. They see a Botox ad at 11 PM and call to book — if nobody answers, they\'ve moved on by morning. $800–$2,000 per treatment lost.',
    roi: 'Average treatment value is $800–$2,000. Repeat clients spend $5,000–$15,000/year. One saved call = massive LTV.',
    hook: 'Med Spa clients are impulse buyers. Sarah answers after-hours calls with a luxury concierge tone and books consultations.',
    faq: 'Can Sarah describe treatments? Yes — she explains Botox, fillers, laser, and body contouring with a premium, knowledgeable tone.',
    objections: 'Spa owners say "our clients prefer online booking." Ask: "What about the 35% who still call, especially for premium treatments?"',
    closing: 'One Botox + filler client Sarah captures after-hours is worth $3,000 in year-one revenue. Worth a quick demo?',
    benefits: 'Luxury tone concierge, treatment menu descriptions, private consultation booking, post-treatment review automation.',
    keywords: ['botox', 'fillers', 'laser treatment', 'body contouring', 'aesthetic clinic', 'cosmetic procedure']
  },
  restaurant: {
    name: 'Restaurants & Catering',
    painPoints: 'Reservation calls on Friday nights go unanswered when staff is slammed. Catering inquiries for $5K+ events lost to voicemail.',
    roi: 'Average catering event is $3,000–$10,000. Regular Friday/Saturday reservation revenue: $500–$2,000/night.',
    hook: 'When your kitchen is in the weeds on a Friday night, Sarah takes every reservation call and catering inquiry.',
    faq: 'Can Sarah handle menu questions? Yes — dietary restrictions, specials, hours, and party booking with zero commission fees.',
    objections: 'Restaurant owners say "we use OpenTable." Ask: "That\'s $2.50 per cover. Sarah does it for zero commission."',
    closing: 'One $5K catering event Sarah captures while you\'re running service — that\'s 17 months of AI service paid. Ready?',
    benefits: 'Zero-commission reservations, catering inquiry capture, menu FAQ handling, wait time updates, event booking.',
    keywords: ['restaurant reservation', 'catering', 'private dining', 'menu', 'takeout', 'food delivery']
  },
  insurance: {
    name: 'Insurance Agencies',
    painPoints: 'Quote requests come in after business hours. Customers shopping insurance call 3–5 agencies — first to respond wins the policy.',
    roi: 'Average new policy premium is $1,500–$5,000/year with 10–15% commission = $150–$750 per policy. Renewals compound annually.',
    hook: 'Insurance shoppers are comparing quotes in real-time. Sarah captures their info and schedules a call before competitors respond.',
    faq: 'Can Sarah provide quotes? She collects required info (vehicle, property, DOB) and schedules a personalized quote callback.',
    objections: 'Agents say "we have online quotes." Ask: "What about the 60% of customers who prefer talking to a person?"',
    closing: 'One auto + home bundle Sarah captures = $2,000+/year in premiums with lifetime renewals. Worth a demo?',
    benefits: '24/7 quote intake, policy type pre-qualification, claims reporting, renewal reminders, referral capture.',
    keywords: ['auto insurance', 'home insurance', 'life insurance', 'insurance quote', 'policy', 'claims']
  },
  auto: {
    name: 'Auto Repair & Body Shops',
    painPoints: 'Breakdown calls on highways need immediate response. Customers stranded with dead cars call the first shop that answers.',
    roi: 'Average repair ticket is $400–$1,500. Collision/body work averages $2,500–$8,000.',
    hook: 'When someone is stranded on the highway, they call 3 shops. Sarah answers first, every time.',
    faq: 'Can Sarah schedule service appointments? Yes — oil changes, brake inspections, diagnostic appointments booked instantly.',
    objections: 'Shop owners say "my guys handle the phones." Ask: "What about when they\'re all in the bay with their hands dirty?"',
    closing: 'One collision repair job Sarah catches = $4,000+ in revenue. That pays for the AI for over a year.',
    benefits: 'Emergency tow coordination, service scheduling, estimate requests, parts availability, warranty claim intake.',
    keywords: ['auto repair', 'oil change', 'brake service', 'collision repair', 'body shop', 'car maintenance']
  },
  landscaping: {
    name: 'Landscaping & Lawn Care',
    painPoints: 'Seasonal rush in spring/summer creates call overflow. Landscapers are on job sites all day and can\'t answer phones.',
    roi: 'Residential contracts average $2,000–$8,000/year. Commercial contracts: $10,000–$50,000/year.',
    hook: 'You\'re on a job site operating a mower — you can\'t answer your phone. Sarah answers every call and books estimates.',
    faq: 'Can Sarah provide service estimates? She collects property size, service type, and schedules an on-site estimate visit.',
    objections: 'Landscapers say "I call them back at lunch." Ask: "By then they\'ve already booked with the guy who answered."',
    closing: 'One commercial lawn care contract Sarah captures = $15K/year in recurring revenue. Want to try it?',
    benefits: 'Estimate scheduling, seasonal service booking, commercial contract intake, snow removal dispatch, design consultations.',
    keywords: ['landscaping', 'lawn care', 'tree trimming', 'hardscaping', 'irrigation', 'garden design']
  },
  gym: {
    name: 'Gym, Fitness & Wellness Studios',
    painPoints: 'New member inquiries come in during class times when staff is coaching. Evening and weekend calls go unanswered — prospects sign up with the gym that responds first.',
    roi: 'Average gym membership is $50–$150/month ($600–$1,800/year). Personal training packages: $2,000–$6,000. One saved lead compounds.',
    hook: 'When your trainers are on the floor and your desk is empty, Sarah answers every membership inquiry and books trial classes.',
    faq: 'Can Sarah handle class schedules? Yes — she explains class times, membership tiers, free trial offers, and books intro sessions.',
    objections: 'Gym owners say "people sign up online." Ask: "What about walk-in inquiries and the 40% who call before committing?"',
    closing: 'One personal training client Sarah captures = $3,000+ in package revenue. Worth a quick demo?',
    benefits: '24/7 membership inquiries, class schedule info, free trial booking, personal training consultations, member referral tracking.',
    keywords: ['gym membership', 'personal training', 'fitness classes', 'yoga studio', 'CrossFit', 'weight loss']
  },
  salon: {
    name: 'Salons, Barbershops & Beauty',
    painPoints: 'Stylists are busy with clients all day and can\'t answer phones. Walk-in heavy businesses lose appointment bookings to competitors who answer calls.',
    roi: 'Average salon client spends $80–$200/visit, 6–12 times per year = $960–$2,400/year lifetime value per client.',
    hook: 'Your stylists are mid-cut with a client — they can\'t grab the phone. Sarah books every appointment and never puts anyone on hold.',
    faq: 'Can Sarah check stylist availability? Yes — she checks open slots, books with preferred stylists, and confirms via text.',
    objections: 'Salon owners say "we use an online booking system." Ask: "What about the clients who prefer to call, especially your high-value regulars?"',
    closing: 'One loyal client Sarah books per week = $5,000+ in annual revenue. Want to hear how she sounds?',
    benefits: 'Appointment booking, stylist availability checks, service menu descriptions, cancellation/rescheduling, loyalty program info.',
    keywords: ['hair salon', 'barbershop', 'haircut', 'color treatment', 'nail salon', 'beauty appointment']
  },
  construction: {
    name: 'General Contractors & Construction',
    painPoints: 'Contractors are on job sites all day in hard hats — answering calls is dangerous and impractical. Estimate requests from homeowners go unreturned for hours.',
    roi: 'Average home renovation project is $15,000–$75,000. Commercial projects: $100K+. One captured bid pays for decades of AI.',
    hook: 'You\'re on a scaffold 30 feet up — you can\'t take a call. Sarah captures every lead, asks project scope questions, and schedules estimates.',
    faq: 'Can Sarah qualify construction leads? Yes — she asks about project type, timeline, budget range, and property details before scheduling.',
    objections: 'Contractors say "I have a secretary." Ask: "What about after 5 PM and weekends when 50% of homeowner inquiries come in?"',
    closing: 'One kitchen remodel lead Sarah captures = $25,000+ in project revenue. That pays for AI for 7 years.',
    benefits: 'Lead qualification, estimate scheduling, project scope intake, subcontractor coordination, permit question handling.',
    keywords: ['general contractor', 'home renovation', 'remodeling', 'kitchen remodel', 'bathroom renovation', 'new construction']
  },
  veterinary: {
    name: 'Veterinary Clinics & Animal Hospitals',
    painPoints: 'Emergency pet calls come at all hours. Pet owners in distress call multiple vets — the first to answer gets the case. After-hours emergencies worth $500–$3,000.',
    roi: 'Average pet owner spends $700–$2,000/year on vet care. Emergency cases: $500–$5,000. Lifetime client value with multiple pets: $10,000+.',
    hook: 'A dog owner at midnight with a sick puppy calls 3 vets — Sarah answers immediately, assesses urgency, and dispatches your on-call vet.',
    faq: 'Can Sarah triage pet emergencies? Yes — she asks key questions about symptoms, pet size, and severity to prioritize urgent cases.',
    objections: 'Vets say "we have an answering service." Ask: "Can your answering service triage pet emergencies and route urgent cases vs routine bookings?"',
    closing: 'One emergency surgery case Sarah captures after-hours = $2,500+ in revenue. Worth trying?',
    benefits: 'Emergency triage, appointment scheduling, medication refill requests, vaccination reminders, post-surgery follow-up.',
    keywords: ['veterinarian', 'pet emergency', 'animal hospital', 'dog vet', 'cat vet', 'pet vaccination']
  },
  ecommerce: {
    name: 'E-Commerce & Retail Stores',
    painPoints: 'Customer service calls about orders, returns, and sizing go unanswered during peak shopping hours. Cart abandonment is 70% — a quick call-back converts 30% of abandoned carts.',
    roi: 'Average order value $50–$200. Customer lifetime value: $500–$5,000. Reducing cart abandonment by 10% = massive revenue lift.',
    hook: 'When a customer is about to abandon a $150 cart because they have a sizing question, Sarah answers instantly and saves the sale.',
    faq: 'Can Sarah handle order status? Yes — she checks order tracking, processes return requests, and answers product questions.',
    objections: 'Store owners say "we have live chat." Ask: "What about the 35% of customers over 40 who prefer calling?"',
    closing: 'Recovering just 5 abandoned carts per week at $100 average = $26,000/year in saved revenue.',
    benefits: 'Order status inquiries, return/exchange processing, product recommendations, sizing help, cart recovery calls.',
    keywords: ['online store', 'ecommerce', 'order tracking', 'return policy', 'product question', 'shopping']
  }
};

function getIndustryInfo(industryKey = 'dental') {
  const norm = String(industryKey).toLowerCase().replace(/[^a-z]/g, '');
  // Fuzzy match
  if (norm.includes('roof')) return INDUSTRIES.roofing;
  if (norm.includes('dent') || norm.includes('ortho')) return INDUSTRIES.dental;
  if (norm.includes('plumb')) return INDUSTRIES.plumbing;
  if (norm.includes('hvac') || norm.includes('air') || norm.includes('heat')) return INDUSTRIES.hvac;
  if (norm.includes('law') || norm.includes('legal') || norm.includes('attorney')) return INDUSTRIES.legal;
  if (norm.includes('real') || norm.includes('property')) return INDUSTRIES.realestate;
  if (norm.includes('spa') || norm.includes('botox') || norm.includes('aesthetic')) return INDUSTRIES.medspa;
  if (norm.includes('rest') || norm.includes('food') || norm.includes('cater')) return INDUSTRIES.restaurant;
  if (norm.includes('insur')) return INDUSTRIES.insurance;
  if (norm.includes('auto') || norm.includes('car') || norm.includes('body') || norm.includes('mechanic')) return INDUSTRIES.auto;
  if (norm.includes('land') || norm.includes('lawn') || norm.includes('garden')) return INDUSTRIES.landscaping;
  if (norm.includes('gym') || norm.includes('fitness') || norm.includes('yoga') || norm.includes('crossfit') || norm.includes('workout')) return INDUSTRIES.gym;
  if (norm.includes('salon') || norm.includes('barber') || norm.includes('hair') || norm.includes('nail') || norm.includes('beauty')) return INDUSTRIES.salon;
  if (norm.includes('construct') || norm.includes('contractor') || norm.includes('remodel') || norm.includes('renovation')) return INDUSTRIES.construction;
  if (norm.includes('vet') || norm.includes('animal') || norm.includes('pet')) return INDUSTRIES.veterinary;
  if (norm.includes('ecommerce') || norm.includes('retail') || norm.includes('shop') || norm.includes('store')) return INDUSTRIES.ecommerce;
  return INDUSTRIES[norm] || INDUSTRIES.dental;
}

function getIndustryContext(industryKey) {
  const ind = getIndustryInfo(industryKey);
  return `=== 7. INDUSTRY INTELLIGENCE (${ind.name}) ===
Pain Point: ${ind.painPoints}
ROI Pitch: ${ind.roi}
Hook: ${ind.hook}
FAQ: ${ind.faq}
Objection Handling: ${ind.objections}
Closing Line: ${ind.closing}
Key Benefits: ${ind.benefits}`;
}

module.exports = {
  INDUSTRIES,
  getIndustryInfo,
  getIndustryContext
};
