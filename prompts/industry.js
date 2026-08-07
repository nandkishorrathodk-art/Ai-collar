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
  if (norm.includes('auto') || norm.includes('car') || norm.includes('body')) return INDUSTRIES.auto;
  if (norm.includes('land') || norm.includes('lawn') || norm.includes('garden')) return INDUSTRIES.landscaping;
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
