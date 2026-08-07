/**
 * Call action handlers — AI emit codes → SMS / CRM / owner notify.
 */
const store = require('./store');
const { normalizePhone } = require('./phone');
const { getOutboundNumber, getMessagingServiceSid } = require('./telephony');
const {
  buildDemoSms,
  buildPaymentSms,
  buildPricingSms,
  getPackage
} = require('./offers');

const ACTION_PATTERNS = [
  { code: 'SEND_DEMO_SMS', re: /\[SEND_DEMO_SMS\]/i },
  { code: 'SEND_INVOICE', re: /\[SEND_INVOICE\]/i },
  { code: 'SEND_PAYMENT', re: /\[SEND_PAYMENT\]/i },
  { code: 'SEND_PRICING', re: /\[SEND_PRICING\]/i },
  { code: 'DEAL_CLOSED', re: /\[DEAL_CLOSED\]/i },
  { code: 'DO_NOT_CALL', re: /\[DO_NOT_CALL\]/i },
  { code: 'BOOK_APPOINTMENT', re: /\[BOOK_APPOINTMENT\]/i },
  { code: 'CAPTURE_LEAD', re: /\[CAPTURE_LEAD\]/i },
  { code: 'EMERGENCY_DISPATCH', re: /\[EMERGENCY_DISPATCH\]/i },
  { code: 'SEND_FOLLOWUP_TEXT', re: /\[SEND_FOLLOWUP_TEXT\]/i }
];

function detectActions(text) {
  if (!text || typeof text !== 'string') return [];
  const found = [];
  for (const { code, re } of ACTION_PATTERNS) {
    if (re.test(text)) found.push(code);
  }
  return found;
}

function resolveActionPhone(lead = {}, meta = {}) {
  const raw =
    lead.targetPhoneNumber ||
    lead.phone ||
    lead.fromNumber ||
    meta.phone ||
    meta.targetPhoneNumber ||
    null;
  return normalizePhone(raw) || (typeof raw === 'string' && raw.startsWith('+') ? raw : null);
}

/**
 * Merge live lead with store so actionsFired / smsSent survive across turns.
 */
function hydrateLead(lead = {}, meta = {}) {
  const callSid = lead.callSid || meta.callSid;
  const fromStore = callSid ? store.getCall(callSid) || {} : {};
  const phone = resolveActionPhone({ ...fromStore, ...lead }, meta);
  const merged = {
    ...fromStore,
    ...lead,
    callSid: callSid || fromStore.callSid,
    targetPhoneNumber: phone || lead.targetPhoneNumber || fromStore.targetPhoneNumber,
    actionsFired: {
      ...(fromStore.actionsFired || {}),
      ...(lead.actionsFired || {})
    }
  };
  // Recover sms flags from store if in-memory lead is a partial snapshot
  if (fromStore.smsSent) merged.smsSent = true;
  if (fromStore.paymentSmsSent) merged.paymentSmsSent = true;
  if (fromStore.dealClosed) merged.dealClosed = true;
  if (fromStore.onboardingToken) merged.onboardingToken = fromStore.onboardingToken;
  return merged;
}

function markFired(lead, dedupeKey, callSid) {
  const at = new Date().toISOString();
  lead.actionsFired = lead.actionsFired || {};
  lead.actionsFired[dedupeKey] = at;
  if (callSid) {
    store.markActionFired(callSid, dedupeKey, at);
  }
}

function createActionRunner({ twilioClient, log = console, notifyOwner } = {}) {
  async function sendSms(to, body, options = {}) {
    const dest = normalizePhone(to) || to;
    if (!dest) throw new Error('No destination phone for message');
    if (!twilioClient) {
      log.warn?.(`[MESSAGING SIM] to=${dest} body=${String(body).slice(0, 80)}...`);
      return { simulated: true, to: dest, body };
    }

    const channel = (process.env.MESSAGING_CHANNEL || 'auto').toLowerCase();
    const useWhatsapp = channel === 'whatsapp' || channel === 'both' || options.whatsapp === true;
    const useSms = channel === 'sms' || channel === 'both' || channel === 'auto' || !useWhatsapp;

    let smsResult = null;
    let waResult = null;
    let lastErr = null;

    // 1. Send SMS if enabled
    if (useSms) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const smsPayload = { body, to: dest };
          const msid = getMessagingServiceSid();
          if (msid) {
            smsPayload.messagingServiceSid = msid;
          } else {
            smsPayload.from = getOutboundNumber();
          }
          const message = await twilioClient.messages.create(smsPayload);
          smsResult = { sid: message.sid, to: dest, channel: 'sms' };
          log.info?.(`[SMS SENT] sid=${message.sid} to=${dest}`);
          break;
        } catch (err) {
          lastErr = err;
          log.error?.({ err: err.message, attempt }, `SMS attempt ${attempt} failed`);
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    // 2. Send WhatsApp if enabled OR if SMS failed in 'auto' mode
    if (useWhatsapp || (channel === 'auto' && !smsResult)) {
      const waFrom = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;
      const formattedWaFrom = waFrom.startsWith('whatsapp:') ? waFrom : `whatsapp:${waFrom}`;
      const formattedWaTo = dest.startsWith('whatsapp:') ? dest : `whatsapp:${dest}`;

      try {
        const message = await twilioClient.messages.create({
          body,
          from: formattedWaFrom,
          to: formattedWaTo
        });
        waResult = { sid: message.sid, to: dest, channel: 'whatsapp' };
        log.info?.(`[WHATSAPP SENT] sid=${message.sid} to=${dest}`);
      } catch (err) {
        log.error?.({ err: err.message }, 'WhatsApp delivery failed');
        if (!smsResult) lastErr = err;
      }
    }

    if (!smsResult && !waResult) {
      store.addEvent({
        type: 'message_failed',
        phone: dest,
        body: String(body).slice(0, 200),
        error: lastErr?.message || 'Delivery failed'
      });
      throw lastErr || new Error('Failed to send SMS/WhatsApp');
    }

    return waResult || smsResult;
  }

  async function ensureOnboardingToken(lead, packageId = 'starter') {
    if (lead.onboardingToken) {
      const existing = store.getOnboarding(lead.onboardingToken);
      if (existing && existing.status === 'pending') return existing;
    }
    return store.createOnboardingToken(lead, { packageId });
  }

  async function handleAction(code, rawLead, meta = {}) {
    const lead = hydrateLead(rawLead, meta);
    const callSid = lead.callSid || meta.callSid;
    const phone = resolveActionPhone(lead, meta);
    const packageId = meta.packageId || lead.packageId || process.env.DEFAULT_PACKAGE || 'starter';

    // Keep caller's object in sync so same-call in-memory lead stays correct
    if (rawLead && typeof rawLead === 'object') {
      rawLead.actionsFired = lead.actionsFired;
      if (phone) rawLead.targetPhoneNumber = phone;
      if (callSid) rawLead.callSid = callSid;
    }

    lead.actionsFired = lead.actionsFired || {};
    const dedupeKey = code === 'SEND_INVOICE' ? 'SEND_PAYMENT' : code;
    if (lead.actionsFired[dedupeKey]) {
      log.info?.(`[ACTION SKIP] ${code} already fired for ${callSid || phone}`);
      return { skipped: true, code };
    }

    // SMS-required actions need a phone
    const needsPhone = [
      'SEND_DEMO_SMS',
      'SEND_INVOICE',
      'SEND_PAYMENT',
      'SEND_PRICING',
      'SEND_FOLLOWUP_TEXT'
    ].includes(code);
    if (needsPhone && !phone) {
      const err = new Error('No destination phone for SMS — lead missing targetPhoneNumber');
      log.error?.({ code, callSid }, err.message);
      store.addEvent({ type: 'action_failed', code, callSid, error: err.message });
      throw err;
    }

    switch (code) {
      case 'SEND_DEMO_SMS': {
        if (lead.smsSent) return { skipped: true, code, reason: 'sms already sent' };
        const body = buildDemoSms(lead);
        const result = await sendSms(phone, body);
        lead.smsSent = true;
        lead.stage = 'demo_sent';
        markFired(lead, dedupeKey, callSid);
        if (rawLead) {
          rawLead.smsSent = true;
          rawLead.stage = 'demo_sent';
          rawLead.actionsFired = lead.actionsFired;
        }
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            smsSent: true,
            stage: 'demo_sent',
            actionsFired: lead.actionsFired
          });
        }
        if (phone) {
          store.setLeadStage(phone, 'demo_sent', {
            smsSent: true,
            clientName: lead.clientName,
            industry: lead.industry
          });
        }
        store.addEvent({
          type: 'SMS_SENT',
          callSid,
          phone,
          result,
          channel: 'sms',
          template: 'demo'
        });
        if (notifyOwner) {
          await notifyOwner('demo_sms_sent', { ...lead, stage: 'demo_sent' });
        }
        log.info?.(`[SMS DEMO] sent to ${phone}`);
        return { ok: true, code, result, body: twilioClient ? undefined : body };
      }

      case 'SEND_INVOICE':
      case 'SEND_PAYMENT': {
        const tokenRec = await ensureOnboardingToken(lead, packageId);
        lead.onboardingToken = tokenRec.token;
        lead.packageId = packageId;
        const body = buildPaymentSms(
          { ...lead, onboardingToken: tokenRec.token, packageId },
          packageId
        );
        const result = await sendSms(phone, body);
        lead.paymentSmsSent = true;
        lead.stage = 'payment_sent';
        markFired(lead, dedupeKey, callSid);
        if (rawLead) {
          rawLead.paymentSmsSent = true;
          rawLead.stage = 'payment_sent';
          rawLead.onboardingToken = tokenRec.token;
          rawLead.actionsFired = lead.actionsFired;
        }
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            paymentSmsSent: true,
            stage: 'payment_sent',
            onboardingToken: tokenRec.token,
            packageId,
            actionsFired: lead.actionsFired
          });
        }
        if (phone) {
          store.setLeadStage(phone, 'payment_sent', {
            paymentSmsSent: true,
            onboardingToken: tokenRec.token,
            packageId
          });
        }
        store.addEvent({
          type: 'SMS_SENT',
          callSid,
          phone,
          packageId,
          onboardingToken: tokenRec.token,
          result,
          channel: 'sms',
          template: 'payment'
        });
        if (notifyOwner) {
          await notifyOwner('payment_sms_sent', {
            ...lead,
            stage: 'payment_sent',
            packageId
          });
        }
        log.info?.(`[SMS PAYMENT] ${packageId} → ${phone}`);
        return {
          ok: true,
          code,
          packageId,
          onboardingToken: tokenRec.token,
          result,
          body: twilioClient ? undefined : body
        };
      }

      case 'SEND_PRICING': {
        const body = buildPricingSms(lead);
        const result = await sendSms(phone, body);
        markFired(lead, dedupeKey, callSid);
        if (phone) store.setLeadStage(phone, lead.stage || 'pricing_sent', { pricingSent: true });
        if (callSid) store.setCall(callSid, { ...lead, actionsFired: lead.actionsFired });
        store.addEvent({
          type: 'SMS_SENT',
          callSid,
          phone,
          result,
          channel: 'sms',
          template: 'pricing'
        });
        log.info?.(`[SMS PRICING] → ${phone}`);
        return { ok: true, code, result, body: twilioClient ? undefined : body };
      }

      case 'SEND_FOLLOWUP_TEXT': {
        const url =
          lead.bookingUrl ||
          lead.demoUrl ||
          process.env.DEFAULT_DEMO_URL ||
          'https://nandkishorzeeroan.vercel.app/';
        const body = `Thanks for calling ${lead.clientName || 'us'}! Link: ${url}`;
        const result = await sendSms(phone, body);
        lead.followupSent = true;
        markFired(lead, dedupeKey, callSid);
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            followupSent: true,
            actionsFired: lead.actionsFired
          });
        }
        store.addEvent({
          type: 'SMS_SENT',
          callSid,
          phone,
          result,
          channel: 'sms',
          template: 'followup'
        });
        return { ok: true, code, result };
      }

      case 'DEAL_CLOSED': {
        lead.dealClosed = true;
        lead.stage = 'deal_closed';
        const tokenRec = await ensureOnboardingToken(lead, packageId);
        lead.onboardingToken = tokenRec.token;
        markFired(lead, dedupeKey, callSid);
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            dealClosed: true,
            stage: 'deal_closed',
            onboardingToken: tokenRec.token,
            actionsFired: lead.actionsFired
          });
        }
        if (phone) {
          store.setLeadStage(phone, 'deal_closed', {
            dealClosed: true,
            onboardingToken: tokenRec.token,
            packageId
          });
        }
        store.addEvent({
          type: 'DEAL_CLOSED',
          callSid,
          phone,
          clientName: lead.clientName,
          packageId,
          onboardingToken: tokenRec.token
        });
        if (notifyOwner) {
          await notifyOwner('deal_closed', { ...lead, stage: 'deal_closed', packageId });
        }
        log.info?.(`[DEAL CLOSED] ${lead.clientName || phone} pkg=${packageId}`);
        return {
          ok: true,
          code,
          onboardingToken: tokenRec.token,
          package: getPackage(packageId)
        };
      }

      case 'DO_NOT_CALL': {
        if (phone) store.markDoNotCall(phone, 'ai_detected_refusal');
        markFired(lead, dedupeKey, callSid);
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            doNotCall: true,
            stage: 'do_not_call',
            actionsFired: lead.actionsFired
          });
        }
        if (notifyOwner) await notifyOwner('do_not_call', lead);
        return { ok: true, code };
      }

      case 'BOOK_APPOINTMENT': {
        store.addEvent({
          type: 'BOOKING_CREATED',
          callSid,
          phone,
          clientName: lead.clientName,
          transcriptSnippet: meta.snippet
        });
        markFired(lead, dedupeKey, callSid);
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            appointmentBooked: true,
            actionsFired: lead.actionsFired
          });
        }
        if (notifyOwner) await notifyOwner('book_appointment', lead, { snippet: meta.snippet });
        return { ok: true, code };
      }

      case 'CAPTURE_LEAD': {
        store.addEvent({
          type: 'capture_lead',
          callSid,
          phone,
          fromNumber: lead.fromNumber,
          clientName: lead.clientName,
          transcriptSnippet: meta.snippet
        });
        markFired(lead, dedupeKey, callSid);
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            leadCaptured: true,
            actionsFired: lead.actionsFired
          });
        }
        if (phone) store.setLeadStage(phone, 'lead_captured', { leadCaptured: true });
        if (notifyOwner) await notifyOwner('lead_captured', lead);
        return { ok: true, code };
      }

      case 'EMERGENCY_DISPATCH': {
        store.addEvent({
          type: 'emergency_dispatch',
          callSid,
          phone,
          clientName: lead.clientName,
          transcriptSnippet: meta.snippet
        });
        const ownerPhone = normalizePhone(lead.ownerPhone) || process.env.OWNER_NOTIFY_PHONE;
        if (ownerPhone) {
          await sendSms(
            ownerPhone,
            `🚨 EMERGENCY for ${lead.clientName || 'business'}. Caller: ${lead.fromNumber || phone || 'unknown'}`
          );
        }
        markFired(lead, dedupeKey, callSid);
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            emergency: true,
            actionsFired: lead.actionsFired
          });
        }
        if (notifyOwner) await notifyOwner('emergency_dispatch', lead);
        return { ok: true, code };
      }

      default:
        return { ok: false, code, error: 'unknown action' };
    }
  }

  async function processTranscript(text, lead, meta = {}) {
    const codes = detectActions(text);
    const results = [];
    for (const code of codes) {
      try {
        results.push(await handleAction(code, lead, { ...meta, snippet: String(text).slice(-200) }));
      } catch (err) {
        log.error?.({ err, code }, 'Action handler error');
        results.push({ ok: false, code, error: err.message });
      }
    }
    return results;
  }

  return {
    detectActions,
    handleAction,
    processTranscript,
    sendSms,
    buildDemoSms,
    ensureOnboardingToken,
    hydrateLead,
    resolveActionPhone
  };
}

module.exports = { createActionRunner, detectActions, ACTION_PATTERNS };
