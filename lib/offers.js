/**
 * Product packages, payment SMS copy, onboarding link builders.
 * Keeps sales funnel pricing in one place.
 */

const PACKAGES = {
  starter: {
    id: 'starter',
    name: 'Starter AI Receptionist',
    setupFee: 499,
    monthly: 297,
    blurb: '24/7 AI voice receptionist + missed-call text-back + review automation'
  },
  pro: {
    id: 'pro',
    name: 'Pro (Website + AI)',
    setupFee: 1500,
    monthly: 297,
    blurb: 'High-converting site + 24/7 AI receptionist package'
  },
  full: {
    id: 'full',
    name: 'Full Package',
    setupFee: 1999,
    monthly: 297,
    blurb: 'Website + AI receptionist + priority onboarding (best value)'
  }
};

function getPackage(id = 'starter') {
  return PACKAGES[id] || PACKAGES.starter;
}

function listPackages() {
  return Object.values(PACKAGES);
}

function publicBaseFromEnv() {
  const host = (process.env.PUBLIC_HOSTNAME || 'localhost:5050').replace(/^https?:\/\//, '');
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  return `${isLocal ? 'http' : 'https'}://${host}`;
}

function whatsappUrl(prefillText) {
  const base = (process.env.WHATSAPP_URL || 'https://wa.me/919226484924').split('?')[0];
  if (!prefillText) return base;
  return `${base}?text=${encodeURIComponent(prefillText)}`;
}

function paymentUrl(lead = {}, packageId = 'starter') {
  const pkg = getPackage(packageId);
  // Prefer package-specific env, then generic payment/invoice URL
  const envKey = `PAYMENT_URL_${pkg.id.toUpperCase()}`;
  return (
    lead.paymentUrl ||
    process.env[envKey] ||
    process.env.PAYMENT_URL ||
    process.env.INVOICE_URL ||
    process.env.DEFAULT_DEMO_URL ||
    'https://nandkishorzeeroan.vercel.app/'
  );
}

function demoUrl(lead = {}) {
  return lead.demoUrl || process.env.DEFAULT_DEMO_URL || 'https://nandkishorzeeroan.vercel.app/';
}

function onboardingUrl(token) {
  if (!token) return null;
  return `${publicBaseFromEnv()}/onboard/${token}`;
}

/**
 * After demo call — demo link + WhatsApp close CTA.
 */
function buildDemoSms(lead = {}) {
  const agent = process.env.AGENT_NAME || 'Sarah';
  const company = process.env.COMPANY_NAME || 'ZeroRefer Studio';
  const url = demoUrl(lead);
  const industry = lead.industry || 'business';
  const name = lead.clientName || 'there';
  const wa = whatsappUrl(
    `Hi! I just got the AI demo for ${lead.clientName || 'my business'} (${industry}). Interested — can we talk?`
  );
  return (
    `Hi ${name} — ${agent} from ${company}.\n\n` +
    `That call was our AI voice agent live.\n` +
    `It can answer your ${industry} phone 24/7 so you never miss a lead.\n\n` +
    `Free demo: ${url}\n` +
    `WhatsApp us: ${wa}`
  );
}

/**
 * Payment-ready SMS — packages + pay link + onboard link + WhatsApp.
 */
function buildPaymentSms(lead = {}, packageId = 'starter') {
  const agent = process.env.AGENT_NAME || 'Sarah';
  const company = process.env.COMPANY_NAME || 'ZeroRefer Studio';
  const pkg = getPackage(packageId);
  const pay = paymentUrl(lead, packageId);
  const onboard = lead.onboardingToken ? onboardingUrl(lead.onboardingToken) : null;
  const wa = whatsappUrl(
    `Hi! I'm ready to activate ${pkg.name} ($${pkg.setupFee} setup + $${pkg.monthly}/mo) for ${lead.clientName || 'my business'}. Please confirm checkout.`
  );

  let msg =
    `Hi ${lead.clientName || 'there'} — ${agent} (${company}).\n\n` +
    `${pkg.name}\n` +
    `$${pkg.setupFee} setup + $${pkg.monthly}/mo\n` +
    `${pkg.blurb}\n\n` +
    `Checkout: ${pay}`;

  if (onboard) {
    msg += `\n\nAfter pay, 60-sec setup: ${onboard}`;
  }

  msg += `\n\nWhatsApp: ${wa}`;
  return msg;
}

/**
 * Short package menu SMS (when they ask pricing).
 */
function buildPricingSms(lead = {}) {
  const agent = process.env.AGENT_NAME || 'Sarah';
  const company = process.env.COMPANY_NAME || 'ZeroRefer Studio';
  const wa = whatsappUrl(
    `Hi! I want pricing for an AI receptionist for ${lead.clientName || 'my business'}.`
  );
  const lines = listPackages()
    .map((p) => `• ${p.name}: $${p.setupFee} + $${p.monthly}/mo`)
    .join('\n');

  return (
    `Hi ${lead.clientName || 'there'} — ${agent} (${company}).\n\n` +
    `Packages:\n${lines}\n\n` +
    `Reply STARTER, PRO, or FULL — or WhatsApp: ${wa}`
  );
}

/**
 * Owner alert text (SMS / webhook / log) when lead goes hot.
 */
function buildOwnerAlert(lead = {}, eventType = 'hot_lead') {
  const phone = lead.targetPhoneNumber || lead.phone || 'unknown';
  const name = lead.clientName || 'Unknown business';
  const industry = lead.industry || 'n/a';
  const stage = lead.stage || eventType;
  const wa = whatsappUrl(
    `Hey! Following up on your AI demo for ${name}. Want me to send the checkout link?`
  );

  const pkg = lead.packageId ? `Pkg: ${lead.packageId}\n` : '';
  return (
    `🔥 ZEROREFER · ${eventType}\n` +
    `${name} (${industry})\n` +
    `Phone: ${phone}\n` +
    `Stage: ${stage}\n` +
    pkg +
    `Call: ${lead.callSid || 'n/a'}\n` +
    `WA close: ${wa}`
  );
}

module.exports = {
  PACKAGES,
  getPackage,
  listPackages,
  whatsappUrl,
  paymentUrl,
  demoUrl,
  onboardingUrl,
  publicBaseFromEnv,
  buildDemoSms,
  buildPaymentSms,
  buildPricingSms,
  buildOwnerAlert
};
