/**
 * Unified Telephony Provider (SignalWire + Twilio Dual Support)
 * USA AI CALLER v4.2
 *
 * Provider selected via TELEPHONY_PROVIDER in .env:
 * - "signalwire" (active default if SignalWire keys present)
 * - "twilio"
 */

const { RestClient: SignalWireClient } = require('@signalwire/compatibility-api');
const twilio = require('twilio');

function resolveTelephonyConfig() {
  const provider = (process.env.TELEPHONY_PROVIDER || 'auto').toLowerCase();
  
  const hasSignalWire = Boolean(
    process.env.SIGNALWIRE_PROJECT_ID &&
    process.env.SIGNALWIRE_API_TOKEN &&
    process.env.SIGNALWIRE_SPACE_URL
  );

  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );

  let activeProvider = 'none';

  if (provider === 'signalwire' || (provider === 'auto' && hasSignalWire)) {
    activeProvider = hasSignalWire ? 'signalwire' : (hasTwilio ? 'twilio' : 'none');
  } else if (provider === 'twilio' || (provider === 'auto' && hasTwilio)) {
    activeProvider = hasTwilio ? 'twilio' : (hasSignalWire ? 'signalwire' : 'none');
  }

  return {
    activeProvider,
    hasSignalWire,
    hasTwilio
  };
}

let cachedClient = null;
let cachedProviderKey = null;

function getTelephonyClient() {
  const cfg = resolveTelephonyConfig();
  const currentKey = `${cfg.activeProvider}:${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}:${process.env.SIGNALWIRE_PROJECT_ID}:${process.env.SIGNALWIRE_API_TOKEN}`;

  if (cachedClient && cachedProviderKey === currentKey) {
    return cachedClient;
  }

  if (cfg.activeProvider === 'signalwire') {
    cachedClient = new SignalWireClient(
      process.env.SIGNALWIRE_PROJECT_ID,
      process.env.SIGNALWIRE_API_TOKEN,
      { signalwireSpaceUrl: process.env.SIGNALWIRE_SPACE_URL }
    );
    cachedProviderKey = currentKey;
    return cachedClient;
  }

  if (cfg.activeProvider === 'twilio') {
    cachedClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    cachedProviderKey = currentKey;
    return cachedClient;
  }

  cachedClient = null;
  cachedProviderKey = null;
  return null;
}

function getOutboundNumber() {
  const cfg = resolveTelephonyConfig();
  if (cfg.activeProvider === 'signalwire') {
    return process.env.SIGNALWIRE_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER;
  }
  return process.env.TWILIO_PHONE_NUMBER;
}

function getMessagingServiceSid() {
  const cfg = resolveTelephonyConfig();
  if (cfg.activeProvider === 'twilio') {
    return process.env.TWILIO_MESSAGING_SERVICE_SID || null;
  }
  return null;
}

module.exports = {
  resolveTelephonyConfig,
  getTelephonyClient,
  getOutboundNumber,
  getMessagingServiceSid
};
