const EVENT_CANONICAL_MAP = {
  call_started: 'CALL_STARTED',
  inbound_call: 'CALL_STARTED',
  call_status: 'CALL_STARTED',
  user_interrupt: 'USER_INTERRUPT',
  barge_in: 'USER_INTERRUPT',
  objection: 'OBJECTION',
  objection_raised: 'OBJECTION',
  sms_demo: 'SMS_SENT',
  sms_payment: 'SMS_SENT',
  sms_pricing: 'SMS_SENT',
  sms_followup: 'SMS_SENT',
  sms_sent: 'SMS_SENT',
  payment_sent: 'PAYMENT_SENT',
  deal_closed: 'DEAL_CLOSED',
  booking_created: 'BOOKING_CREATED',
  book_appointment: 'BOOKING_CREATED',
  call_completed: 'CALL_COMPLETED',
  machine_detected: 'MACHINE_DETECTED',
  machine_hangup: 'MACHINE_DETECTED',
  action_failed: 'ACTION_FAILED',
  sms_failed: 'SMS_FAILED'
};

const FUNNEL_SEQUENCE = ['CALL_STARTED', 'SMS_SENT', 'PAYMENT_SENT', 'BOOKING_CREATED', 'CALL_COMPLETED'];
const TOOL_SUCCESS_TYPES = ['SMS_SENT', 'PAYMENT_SENT', 'BOOKING_CREATED'];
const TOOL_FAILURE_TYPES = ['ACTION_FAILED', 'SMS_FAILED'];
const EVENT_SUCCESS_WEIGHTS = {
  CALL_STARTED: 1,
  USER_INTERRUPT: 1,
  OBJECTION: 1,
  SMS_SENT: 1,
  PAYMENT_SENT: 1,
  BOOKING_CREATED: 1,
  CALL_COMPLETED: 1
};

function normalizeEventType(type = '') {
  const key = String(type || '').trim().toLowerCase();
  return EVENT_CANONICAL_MAP[key] || String(type || '').trim().toUpperCase();
}

function buildAnalyticsSummary({ events = [], calls = [], leads = [] } = {}) {
  const normalizedEvents = events.map((event) => ({
    ...event,
    type: normalizeEventType(event.type),
    at: event.at || event.updatedAt || null
  }));

  const eventCounts = normalizedEvents.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});

  const callDurations = calls
    .map((call) => Number(call.duration || call.analytics?.durationSec || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageCallDuration = callDurations.length
    ? callDurations.reduce((sum, value) => sum + value, 0) / callDurations.length
    : 0;

  const objectionEvents = normalizedEvents.filter((event) => event.type === 'OBJECTION');
  // BUGFIX: previously counted only success-type events in both the numerator
  // AND denominator, so toolSuccessRate was mathematically guaranteed to be
  // 100% (or 0%) regardless of how many SMS/action attempts actually failed.
  // Now failures (ACTION_FAILED / SMS_FAILED) are included in the denominator
  // so the rate reflects real success vs. attempted.
  const successfulToolEvents = normalizedEvents.filter((event) => TOOL_SUCCESS_TYPES.includes(event.type));
  const failedToolEvents = normalizedEvents.filter((event) => TOOL_FAILURE_TYPES.includes(event.type));
  const successfulTools = successfulToolEvents.length;
  const totalToolAttempts = successfulToolEvents.length + failedToolEvents.length;
  const toolSuccessRate = totalToolAttempts ? Math.round((successfulTools / totalToolAttempts) * 100) : 0;
  const totalEventCount = normalizedEvents.reduce((sum, event) => sum + (EVENT_SUCCESS_WEIGHTS[event.type] || 0), 0);

  const funnel = FUNNEL_SEQUENCE.reduce((acc, step) => {
    acc[step] = eventCounts[step] || 0;
    return acc;
  }, {});

  const conversionRate = funnel.CALL_STARTED
    ? Math.round(((funnel.CALL_COMPLETED || 0) / funnel.CALL_STARTED) * 100)
    : 0;

  const revenueAttributed = leads.filter((lead) => lead.dealClosed || lead.paymentSmsSent).length;

  return {
    eventCounts,
    funnel,
    funnelConversionRate: conversionRate,
    averageCallDuration,
    objectionFrequency: objectionEvents.length,
    toolSuccessRate,
    totalEventCount,
    revenueAttribution: {
      closedDeals: revenueAttributed,
      packageBreakdown: leads.reduce((acc, lead) => {
        const key = lead.packageId || 'unknown';
        acc[key] = (acc[key] || 0) + (lead.dealClosed || lead.paymentSmsSent ? 1 : 0);
        return acc;
      }, {})
    },
    normalizedEvents
  };
}

module.exports = {
  EVENT_CANONICAL_MAP,
  FUNNEL_SEQUENCE,
  TOOL_SUCCESS_TYPES,
  TOOL_FAILURE_TYPES,
  normalizeEventType,
  buildAnalyticsSummary
};
