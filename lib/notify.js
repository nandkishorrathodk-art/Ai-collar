/**
 * Owner / ops notifications when funnel events fire.
 *
 * What is realistically possible without Meta WhatsApp Business API:
 * 1. SMS to OWNER_NOTIFY_PHONE (Twilio) — works today
 * 2. HTTPS webhook (Zapier / Make / n8n → WhatsApp) — best "auto WhatsApp"
 * 3. Console + store event — always works in simulation
 *
 * True auto-WhatsApp to the LEAD requires WhatsApp Business API approval.
 * Lead path uses wa.me deep links inside SMS (works everywhere).
 */

const store = require('./store');
const { buildOwnerAlert } = require('./offers');
const { getOutboundNumber, getMessagingServiceSid } = require('./telephony');

async function postWebhook(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Webhook ${res.status}: ${text.slice(0, 200)}`);
  }
  return { ok: true, status: res.status };
}

/**
 * @param {{ twilioClient?: import('twilio').Twilio | null, log?: any }} deps
 */
function createNotifier({ twilioClient = null, log = console } = {}) {
  async function notifyOwner(eventType, lead = {}, extra = {}) {
    const phone = lead.targetPhoneNumber || lead.phone || extra.phone;
    const payload = {
      source: 'usa-ai-caller',
      eventType,
      at: new Date().toISOString(),
      lead: {
        clientName: lead.clientName,
        industry: lead.industry,
        phone,
        stage: lead.stage,
        callSid: lead.callSid,
        demoUrl: lead.demoUrl,
        packageId: lead.packageId || extra.packageId
      },
      extra,
      alertText: buildOwnerAlert({ ...lead, targetPhoneNumber: phone }, eventType)
    };

    const results = { eventType, channels: [] };

    // Always persist
    store.addEvent({ type: `notify_${eventType}`, phone, clientName: lead.clientName, ...extra });
    results.channels.push({ channel: 'store', ok: true });

    // Webhook → Make/Zapier can push to your WhatsApp
    const webhook = process.env.OWNER_WEBHOOK_URL || process.env.HOT_LEAD_WEBHOOK_URL;
    if (webhook) {
      try {
        const wh = await postWebhook(webhook, payload);
        results.channels.push({ channel: 'webhook', ...wh });
        log.info?.(`[NOTIFY] webhook ok for ${eventType}`);
      } catch (err) {
        results.channels.push({ channel: 'webhook', ok: false, error: err.message });
        log.error?.({ err }, 'Owner webhook failed');
      }
    }

    // SMS / WhatsApp to owner
    const ownerPhone = process.env.OWNER_NOTIFY_PHONE;
    if (ownerPhone && twilioClient) {
      const channel = (process.env.OWNER_NOTIFY_CHANNEL || 'sms').toLowerCase();

      if (channel === 'whatsapp' || channel === 'both') {
        try {
          const waFrom = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;
          const formattedWaFrom = waFrom.startsWith('whatsapp:') ? waFrom : `whatsapp:${waFrom}`;
          const formattedWaTo = ownerPhone.startsWith('whatsapp:') ? ownerPhone : `whatsapp:${ownerPhone}`;
          const msg = await twilioClient.messages.create({
            body: payload.alertText.slice(0, 1500),
            from: formattedWaFrom,
            to: formattedWaTo
          });
          results.channels.push({ channel: 'owner_whatsapp', ok: true, sid: msg.sid });
          log.info?.(`[NOTIFY] owner WhatsApp ${msg.sid}`);
        } catch (err) {
          results.channels.push({ channel: 'owner_whatsapp', ok: false, error: err.message });
          log.error?.({ err: err.message }, 'Owner WhatsApp failed');
        }
      }

      if (channel === 'sms' || channel === 'both' || results.channels.every((c) => !c.ok)) {
        try {
          const smsPayload = {
            body: payload.alertText.slice(0, 1500),
            to: ownerPhone
          };
          const msid = getMessagingServiceSid();
          if (msid) {
            smsPayload.messagingServiceSid = msid;
          } else {
            smsPayload.from = getOutboundNumber();
          }
          const msg = await twilioClient.messages.create(smsPayload);
          results.channels.push({ channel: 'owner_sms', ok: true, sid: msg.sid });
          log.info?.(`[NOTIFY] owner SMS ${msg.sid}`);
        } catch (err) {
          results.channels.push({ channel: 'owner_sms', ok: false, error: err.message });
          log.error?.({ err: err.message }, 'Owner SMS failed');
        }
      }
    } else if (ownerPhone && !twilioClient) {
      results.channels.push({
        channel: 'owner_sms',
        ok: true,
        simulated: true,
        to: ownerPhone,
        body: payload.alertText
      });
      log.info?.(`[NOTIFY SIM] would SMS owner ${ownerPhone}: ${eventType}`);
    }

    log.info?.(`[NOTIFY] ${eventType} → ${lead.clientName || phone || 'n/a'}`);
    return results;
  }

  return { notifyOwner };
}

module.exports = { createNotifier };
