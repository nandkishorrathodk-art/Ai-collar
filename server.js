/* ====================================================================
   USA AI CALLER — v4.1.1 Funnel Edition
   Twilio + OpenAI Realtime/Hybrid + Sales funnel (demo → WA → pay → onboard)
   Fixes: onboarding DID, store flush, safe planner, Twilio sig, transcript brain
   ==================================================================== */
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const fastify = require('fastify')({
  logger: true,
  requestTimeout: 30000
});
const formbody = require('@fastify/formbody');
const fastifyWs = require('@fastify/websocket');
const twilio = require('twilio');

const store = require('./lib/store');
const { normalizePhone, isValidPhone } = require('./lib/phone');
const {
  resolveTelephonyConfig,
  getTelephonyClient,
  getOutboundNumber,
  getMessagingServiceSid
} = require('./lib/telephony');
const { createActionRunner } = require('./lib/actions');
const { createNotifier } = require('./lib/notify');
const { attachMediaStreamHandler, resolveRealtimeConfig } = require('./lib/realtime');
const { ConversationManager } = require('./lib/conversation-manager');
const { createToolDispatcher } = require('./lib/tool-dispatcher');
const { createPlannerSupervisor } = require('./lib/planner');
const { createEventBus } = require('./src/runtime/event-bus');
const { createSessionRuntime } = require('./src/runtime/session');
const { createContextSnapshot } = require('./src/runtime/context');
const { providerManager } = require('./src/providers');
const { registerDefaultProviders } = require('./src/providers/bootstrap');
const {
  createConversationState,
  mergeConversationState,
  recordObjection,
  recordQuestion,
  summarizeConversationState
} = require('./lib/conversation-memory');
const { pickObjectionResponse } = require('./lib/objection-engine');
const {
  listPackages,
  getPackage,
  onboardingUrl,
  buildDemoSms,
  buildPaymentSms
} = require('./lib/offers');
const { runDiagnostics } = require('./lib/diagnostics');
const { buildAnalyticsSummary } = require('./lib/analytics');
const { createTwilioSignatureGuard } = require('./lib/twilio-auth');
const {
  getUniversalPitch,
  getFollowUpPitch,
  getInboundPitch,
  INDUSTRY_DB,
  resolveIndustry
} = require('./config/prompts');

fastify.register(formbody);
fastify.register(fastifyWs);

// Serve static files from /public
fastify.register(async function staticPlugin(instance) {
  instance.get('/dashboard', async (req, reply) => {
    const dashboardFile = path.join(__dirname, 'public', 'index.html');
    if (!fs.existsSync(dashboardFile)) {
      return reply.status(404).send('Dashboard not found');
    }
    reply.type('text/html').send(fs.readFileSync(dashboardFile, 'utf8'));
  });
  instance.get('/public/:file', async (req, reply) => {
    const filePath = path.join(__dirname, 'public', req.params.file);
    if (!fs.existsSync(filePath)) return reply.status(404).send('Not found');
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    reply.type(mimeTypes[ext] || 'application/octet-stream').send(fs.readFileSync(filePath));
  });
});

const APP_VERSION = '4.1.1';
const PORT = Number(process.env.PORT) || 5050;
const PUBLIC_HOSTNAME = (process.env.PUBLIC_HOSTNAME || 'localhost:5050').replace(
  /^https?:\/\//,
  ''
);
const API_KEY = process.env.API_KEY || '';
const DEFAULT_DEMO_URL = process.env.DEFAULT_DEMO_URL || 'https://nandkishorzeeroan.vercel.app/';
const AGENT_NAME = process.env.AGENT_NAME || 'Sarah';
const COMPANY_NAME = process.env.COMPANY_NAME || 'ZeroRefer Studio';

/** Build a readiness snapshot used by /health, /, and boot logs. */
function buildReadiness() {
  const realtime = resolveRealtimeConfig();
  const telephonyCfg = resolveTelephonyConfig();
  const telephonyOk = Boolean(telephonyClient);
  const voiceOk = Boolean(realtime?.ready);
  const ownerOk = Boolean(process.env.OWNER_NOTIFY_PHONE || process.env.OWNER_WEBHOOK_URL);
  const authOk = Boolean(API_KEY);
  const checks = {
    telephony: telephonyOk,
    voice: voiceOk,
    ownerNotify: ownerOk,
    apiAuth: authOk,
    publicHost: Boolean(PUBLIC_HOSTNAME && !PUBLIC_HOSTNAME.startsWith('localhost'))
  };
  const readyCount = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;
  let status = 'ready';
  if (!voiceOk || !telephonyOk) status = 'degraded';
  if (!telephonyOk && !voiceOk) status = 'setup';
  return {
    status,
    score: `${readyCount}/${total}`,
    checks,
    realtime,
    telephonyOk,
    telephonyProvider: telephonyCfg.activeProvider,
    twilioOk: telephonyOk,
    voiceOk,
    ownerOk,
    authOk
  };
}

/* ====================================================================
   Simple in-memory rate limiter — protects credits from spam
   ==================================================================== */
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 10); // max requests per window

/** Prefer first IP in X-Forwarded-For (ignore spoofed tail). */
function clientIp(request) {
  const xff = request.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).split(',')[0].trim();
  return request.ip || 'unknown';
}

function rateLimitCheck(ip) {
  const key = String(ip || 'unknown');
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count++;
  rateLimitStore.set(key, entry);
  return entry.count <= RATE_LIMIT_MAX;
}

function enforceRateLimit(request, reply) {
  const ip = clientIp(request);
  if (!rateLimitCheck(ip)) {
    reply.status(429).send({
      error: 'Too many requests',
      retryAfterSeconds: 60,
      limit: RATE_LIMIT_MAX
    });
    return false;
  }
  return true;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetAt + RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(ip);
  }
}, 300_000);

const telephonyClient = getTelephonyClient();
const twilioClient = telephonyClient; // Alias for backward compatibility

const logBridge = {
  info: (msg) => fastify.log.info(msg),
  warn: (msg) => fastify.log.warn(msg),
  error: (obj, msg) => (msg ? fastify.log.error(obj, msg) : fastify.log.error(obj))
};

// Register real AI providers (LLM/STT/TTS/Voice) with the shared provider
// registry. Additive only — does not change how the live Twilio call path
// (lib/realtime.js / lib/hybrid-voice.js) works, but makes these providers
// available for diagnostics, testing, or future call-path consolidation.
const aiProviders = registerDefaultProviders({ log: logBridge });

const eventBus = createEventBus();
const sessionRuntime = createSessionRuntime({ eventBus, store });
const notifier = createNotifier({ twilioClient, log: logBridge });
const actions = createActionRunner({
  twilioClient,
  log: logBridge,
  notifyOwner: (type, lead, extra) => notifier.notifyOwner(type, lead, extra)
});
const toolDispatcher = createToolDispatcher({
  actionRunner: actions,
  store,
  log: logBridge,
  eventBus
});
const planner = createPlannerSupervisor({
  toolDispatcher,
  log: logBridge,
  eventBus
});
eventBus.on('INTENT_CHANGED', (payload) => {
  fastify.log.info?.({ payload }, '[EVENT BUS] INTENT_CHANGED');
});
eventBus.on('TOOL_COMPLETED', (payload) => {
  fastify.log.info?.({ payload }, '[EVENT BUS] TOOL_COMPLETED');
});

eventBus.on('CALL_ENDED', (payload) => {
  fastify.log.info?.({ payload }, '[EVENT BUS] CALL_ENDED');
});

// v3.0: Stale call cleanup — runs every 10 minutes
setInterval(() => {
  const cleaned = store.cleanupStaleCalls();
  if (cleaned > 0) {
    fastify.log.info?.(`[CLEANUP] Cleaned ${cleaned} stale calls`);
  }
}, 10 * 60 * 1000); // 10 minutes

// Run once at startup to clean any existing stale calls
setTimeout(() => {
  const cleaned = store.cleanupStaleCalls();
  if (cleaned > 0) {
    fastify.log.info?.(`[STARTUP CLEANUP] Cleaned ${cleaned} stale calls`);
  }
}, 5000);

const conversationMemory = new Map();

function getConversationContext(callSid, seed = {}) {
  const existing = conversationMemory.get(callSid) || createConversationState(seed);
  const state = mergeConversationState(existing, seed);
  conversationMemory.set(callSid, state);
  return state;
}

function attachConversationSignals(callSid, payload = {}) {
  const state = getConversationContext(callSid);
  const withQuestions = payload.question ? recordQuestion(state, payload.question) : state;
  const withObjection = payload.objection ? recordObjection(withQuestions, payload.objection) : withQuestions;
  if (payload.objection) {
    store.addEvent({
      type: 'OBJECTION',
      callSid,
      phone: payload.phone || payload.targetPhoneNumber || null,
      objection: payload.objection
    });
  }
  const summary = summarizeConversationState(withObjection);
  conversationMemory.set(callSid, withObjection);
  return summary;
}

function buildMemorySummaryString(callSid) {
  const state = conversationMemory.get(callSid) || createConversationState();
  const summary = summarizeConversationState(state);
  return [
    `Emotion: ${summary.emotion}`,
    `Interest: ${summary.interestLevel}`,
    `Lead Score: ${summary.leadScore}`,
    `Objections: ${summary.objections.join(', ') || 'none'}`,
    `Questions Asked: ${summary.questionsAsked.join(', ') || 'none'}`
  ].join(' | ');
}

function getObjectionReply(objectionKey) {
  return pickObjectionResponse(objectionKey);
}

async function dispatchToolPlan(plan, lead, meta = {}) {
  const session = sessionRuntime.getSession(meta.callSid || lead?.callSid || 'system');
  eventBus.emit('TOOL_REQUESTED', { callSid: session.callSid, lead, plan, meta });
  const result = await toolDispatcher.dispatch(plan, lead, meta);
  eventBus.emit('TOOL_COMPLETED', { callSid: session.callSid, lead, result, meta });
  return result;
}

async function runPlannerTurn({ transcript = '', manager = null, lead = {}, meta = {} } = {}) {
  const session = sessionRuntime.getSession(meta.callSid || lead?.callSid || 'system');
  const context = createContextSnapshot(session, { callSid: meta.callSid || lead?.callSid || 'system' });
  const result = await planner.execute({ transcript, manager, lead, meta: { ...meta, context } });
  if (result?.plan) {
    eventBus.emit('INTENT_CHANGED', {
      callSid: context.callSid,
      intent: result.plan.intent,
      emotion: result.plan.emotion,
      nextState: result.plan.nextState,
      responseMode: result.plan.responseMode
    });
  }
  return result;
}

/**
 * Conversation managers keyed by callSid.
 * Store full manager JSON (not just memory) so state survives hydrate.
 */
const conversationManagers = new Map();

function ensureConversationManager(callSid, seed = {}) {
  if (!callSid) return new ConversationManager({ callSid: 'unknown', seed });

  if (conversationManagers.has(callSid)) {
    return conversationManagers.get(callSid);
  }

  const fromStore = store.getConversation(callSid);
  if (fromStore && (fromStore.memory || fromStore.currentState)) {
    const manager = ConversationManager.hydrate({
      callSid,
      memory: fromStore.memory || seed,
      currentState: fromStore.currentState || 'START',
      intentHistory: fromStore.intentHistory,
      actionQueue: fromStore.actionQueue,
      lastTurnAt: fromStore.lastTurnAt
    });
    conversationManagers.set(callSid, manager);
    return manager;
  }

  const manager = new ConversationManager({ callSid, seed });
  conversationManagers.set(callSid, manager);
  store.upsertConversation(callSid, manager.toJSON());
  return manager;
}

/**
 * Live call transcript pipeline:
 * 1) Track intent/emotion/lead score (always)
 * 2) Fire AI emit-codes via action bus (always)
 * 3) Optional planner auto-tools only if PLANNER_AUTO_TOOLS=true
 */
async function processCallTranscript(text, lead = {}, meta = {}) {
  const callSid = lead?.callSid || meta.callSid;
  const liveLead = callSid ? { ...(store.getCall(callSid) || {}), ...lead } : { ...lead };
  liveLead.callSid = callSid || liveLead.callSid;
  liveLead.actionsFired = liveLead.actionsFired || {};

  // 1) Conversation intelligence (no side-effect SMS)
  if (callSid && text) {
    try {
      const manager = ensureConversationManager(callSid, {
        clientName: liveLead.clientName,
        industry: liveLead.industry
      });
      const summary = manager.processTurn(text, { callSid });
      store.upsertConversation(callSid, {
        ...manager.toJSON(),
        summary: summary?.memory || null,
        leadScore: summary?.memory?.leadScore
      });
      conversationMemory.set(callSid, manager.memory);
      eventBus.emit('INTENT_CHANGED', {
        callSid,
        intent: summary?.memory?.lastIntent || summary?.currentState,
        emotion: summary?.memory?.emotion,
        nextState: summary?.currentState,
        leadScore: summary?.memory?.leadScore
      });
      // Mirror score onto call record for /api/analytics
      if (summary?.memory?.leadScore != null) {
        store.setCall(callSid, {
          ...liveLead,
          leadScore: summary.memory.leadScore,
          conversationState: summary.currentState
        });
      }
    } catch (err) {
      fastify.log.warn?.({ err }, 'conversation tracking failed');
    }
  }

  // 2) Emit-code actions (primary side effects)
  const results = await actions.processTranscript(text, liveLead, meta);

  // 3) Optional auto tools (OFF by default — was a major bug when always on)
  if (
    String(process.env.PLANNER_AUTO_TOOLS || '').toLowerCase() === 'true' &&
    callSid &&
    text
  ) {
    try {
      const manager = ensureConversationManager(callSid);
      await runPlannerTurn({
        transcript: text,
        manager,
        lead: liveLead,
        meta: { ...meta, callSid, autoTools: true }
      });
    } catch (err) {
      fastify.log.warn?.({ err }, 'planner auto-tools failed');
    }
  }

  return results;
}

function requireApiKey(request, reply, done) {
  if (!API_KEY) {
    // Soft warning once per process in logs for production footgun
    if (!requireApiKey._warned) {
      requireApiKey._warned = true;
      fastify.log.warn?.(
        'API_KEY is not set — control endpoints are open. Set API_KEY in .env for production.'
      );
    }
    return done();
  }
  const key =
    request.headers['x-api-key'] ||
    request.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    request.query?.apiKey;
  if (key !== API_KEY) {
    reply.status(401).send({ error: 'Unauthorized — provide x-api-key header' });
    return;
  }
  done();
}
requireApiKey._warned = false;

const requireTwilioSignature = createTwilioSignatureGuard({
  publicHostname: PUBLIC_HOSTNAME,
  log: {
    info: (m) => fastify.log.info(m),
    warn: (m) => fastify.log.warn(m),
    error: (o, m) => (m ? fastify.log.error(o, m) : fastify.log.error(o))
  }
});

function publicBase() {
  const isLocal =
    PUBLIC_HOSTNAME.startsWith('localhost') || PUBLIC_HOSTNAME.startsWith('127.0.0.1');
  return `${isLocal ? 'http' : 'https'}://${PUBLIC_HOSTNAME}`;
}

function twimlStream(callSid, extraParams = {}) {
  const params = Object.entries({ callSid, ...extraParams })
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `      <Parameter name="${k}" value="${String(v).replace(/"/g, '&quot;')}" />`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Connect>
    <Stream url="wss://${PUBLIC_HOSTNAME}/media-stream">
${params}
    </Stream>
  </Connect>
</Response>`;
}

async function placeOutboundCall({ to, lead }) {
  const fromNumber = getOutboundNumber();
  const call = await telephonyClient.calls.create({
    url: `${publicBase().replace(/^http:/, 'https:')}/twiml-outbound`,
    to,
    from: fromNumber,
    statusCallback: `${publicBase().replace(/^http:/, 'https:')}/call-status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
    machineDetection: process.env.MACHINE_DETECTION === 'true' ? 'Enable' : undefined,
    timeout: Number(process.env.CALL_TIMEOUT_SECONDS) || 30
  });

  store.setCall(call.sid, {
    ...lead,
    targetPhoneNumber: to,
    callSid: call.sid,
    status: call.status || 'initiated',
    stage: 'called',
    direction: 'outbound'
  });
  return call;
}

function setupReceptionistFromBody(body = {}) {
  const {
    clientName,
    industry,
    ownerName,
    services,
    businessHours,
    bookingUrl,
    emergencyProtocol,
    twilioPhoneNumber,
    ownerPhone,
    pricingNotes,
    customInstructions
  } = body;

  if (!clientName || !industry) {
    const err = new Error('clientName and industry are required');
    err.statusCode = 400;
    throw err;
  }

  const normalizedTwilio = twilioPhoneNumber ? normalizePhone(twilioPhoneNumber) : null;
  const serviceList = Array.isArray(services)
    ? services
    : String(services || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  const receptionistPrompt = getInboundPitch({
    clientName,
    industry,
    ownerName,
    services: serviceList,
    businessHours,
    bookingUrl,
    emergencyProtocol,
    pricingNotes,
    customInstructions
  });

  const configKey = `receptionist_${(normalizedTwilio || clientName).replace(/[^a-zA-Z0-9]/g, '_')}`;
  const config = store.setReceptionist(configKey, {
    type: 'inbound-receptionist',
    clientName,
    industry,
    ownerName,
    services: serviceList,
    businessHours,
    bookingUrl,
    emergencyProtocol,
    twilioPhoneNumber: normalizedTwilio,
    ownerPhone: ownerPhone ? normalizePhone(ownerPhone) : null,
    pricingNotes,
    customInstructions,
    systemPrompt: receptionistPrompt
  });

  return {
    config,
    configKey,
    receptionistPrompt,
    normalizedTwilio,
    voiceWebhook: `${publicBase().replace(/^http:/, 'https:')}/twiml-inbound`,
    statusCallback: `${publicBase().replace(/^http:/, 'https:')}/call-status`
  };
}

/* ====================================================================
   ROOT + HEALTH
   ==================================================================== */
fastify.setErrorHandler((err, request, reply) => {
  const status = err.statusCode || err.status || 500;
  if (status >= 500) {
    fastify.log.error({ err, url: request.url }, 'request error');
  } else {
    fastify.log.warn?.({ err: err.message, url: request.url }, 'client error');
  }
  reply.status(status).send({
    ok: false,
    error: err.message || 'Internal Server Error',
    code: err.code || undefined,
    statusCode: status
  });
});

fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    ok: false,
    error: 'Not found',
    path: request.url,
    hint: 'Try GET /health or GET / for service map'
  });
});

fastify.get('/', async (request, reply) => {
  const readiness = buildReadiness();
  const accept = String(request.headers.accept || '');
  // Browser-friendly: serve premium dashboard
  if (accept.includes('text/html')) {
    const dashboardFile = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(dashboardFile)) {
      reply.type('text/html').send(fs.readFileSync(dashboardFile, 'utf8'));
      return;
    }
    // Fallback mini status if dashboard file missing
    const rows = Object.entries(readiness.checks)
      .map(
        ([k, v]) =>
          `<tr><td>${k}</td><td class="${v ? 'ok' : 'bad'}">${v ? 'ready' : 'missing'}</td></tr>`
      )
      .join('');
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${COMPANY_NAME} — AI Caller</title>
<style>
  :root{--bg:#0b1220;--card:#121a2b;--line:#243049;--text:#e8eefc;--muted:#93a0b8;--ok:#3dd68c;--bad:#ff6b6b;--accent:#5b8cff}
  body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);display:flex;justify-content:center;align-items:center;min-height:100vh}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:32px;max-width:400px}
  h1{margin:0 0 16px;font-size:1.3rem}
  .ok{color:var(--ok)} .bad{color:var(--bad)}
  table{width:100%;border-collapse:collapse;font-size:14px}
  td{padding:8px 4px;border-bottom:1px solid var(--line)}
</style></head><body>
<div class="card">
  <h1>🇺🇸 USA AI Caller v${APP_VERSION}</h1>
  <p style="color:var(--muted);margin:0 0 16px">Status: ${readiness.status} · ${readiness.score}</p>
  <table>${rows}</table>
  <p style="color:var(--muted);font-size:12px;margin:16px 0 0">Dashboard file not found. Create public/index.html.</p>
</div></body></html>`);
    return;
  }
  return {
    ok: true,
    service: 'USA AI CALLER',
    version: APP_VERSION,
    agent: AGENT_NAME,
    company: COMPANY_NAME,
    status: readiness.status,
    readiness: readiness.checks,
    endpoints: {
      health: '/health',
      dashboard: '/dashboard',
      stats: '/api/stats',
      events: '/api/events',
      diagnostics: '/api/diagnostics',
      dashboardStats: '/api/dashboard-stats',
      simulate: 'POST /api/funnel/simulate',
      call: 'POST /api/call-usa-client',
      onboard: '/onboard/:token'
    }
  };
});

fastify.get('/favicon.ico', async (request, reply) => {
  reply.code(204).send();
});

fastify.get('/health', async (request, reply) => {
  const readiness = buildReadiness();
  const realtime = readiness.realtime;
  const body = {
    ok: readiness.status !== 'setup',
    status: readiness.status,
    version: APP_VERSION,
    uptimeSec: Math.round(process.uptime()),
    agent: AGENT_NAME,
    company: COMPANY_NAME,
    funnel: {
      demoSms: true,
      paymentSms: true,
      onboardingForm: true,
      ownerNotify: readiness.ownerOk,
      whatsappDeepLink: true,
      whatsappBusinessApi: false
    },
    twilio: {
      configured: readiness.twilioOk,
      mode: readiness.twilioOk ? 'live' : 'simulation'
    },
    realtime: {
      ready: readiness.voiceOk,
      path: realtime?.path || null,
      provider: realtime?.provider || null,
      model: realtime?.model || null,
      voice: realtime?.voice || null,
      sttModel: realtime?.sttModel || null,
      ttsModel: realtime?.ttsModel || null,
      blockers: realtime?.blockers || []
    },
    providers: {
      llm: aiProviders.llm.isConfigured(),
      stt: aiProviders.stt.isConfigured(),
      tts: aiProviders.tts.isConfigured(),
      voice: aiProviders.voice.isConfigured()
    },
    publicHostname: PUBLIC_HOSTNAME,
    apiAuth: readiness.authOk,
    security: {
      apiKeyEnabled: readiness.authOk,
      twilioSignatureStrict:
        process.env.REQUIRE_TWILIO_SIGNATURE === 'true' ||
        process.env.NODE_ENV === 'production',
      plannerAutoTools: String(process.env.PLANNER_AUTO_TOOLS || '').toLowerCase() === 'true',
      hangupOnMachine: process.env.HANGUP_ON_MACHINE !== 'false'
    },
    readiness: readiness.checks,
    readinessScore: readiness.score,
    packages: listPackages(),
    stats: store.stats()
  };
  // 503 only when completely unusable for calls
  if (readiness.status === 'setup') reply.code(503);
  return body;
});

fastify.get('/api/stats', { preHandler: requireApiKey }, async () => store.stats());
fastify.get('/api/packages', async () => ({ packages: listPackages() }));

/**
 * Dashboard stats endpoint — aggregated data for the premium admin dashboard.
 */
fastify.get('/api/dashboard-stats', async () => {
  const readiness = buildReadiness();
  return {
    ...store.getDashboardStats(),
    readiness: {
      status: readiness.status,
      score: readiness.score,
      checks: readiness.checks,
      voicePath: readiness.realtime?.path || 'none',
      voiceProvider: readiness.realtime?.provider || 'none',
      voiceModel: readiness.realtime?.model || null
    },
    server: {
      version: APP_VERSION,
      agent: AGENT_NAME,
      company: COMPANY_NAME,
      publicHostname: PUBLIC_HOSTNAME,
      uptimeSec: Math.round(process.uptime()),
      apiKeySet: Boolean(API_KEY)
    },
    packages: listPackages()
  };
});

/**
 * Live probe of Groq / ElevenLabs / Twilio / OpenAI.
 * Use this after editing .env — tells you exactly what still blocks a real call.
 */
fastify.get('/api/diagnostics', { preHandler: requireApiKey }, async (request) => {
  const includeStt = request.query?.stt !== '0';
  return runDiagnostics({ includeStt });
});

fastify.get('/api/calls', { preHandler: requireApiKey }, async (request) => {
  const limit = Math.min(Number(request.query?.limit) || 50, 200);
  return { calls: store.listCalls({ limit, status: request.query?.status }) };
});

fastify.get('/api/calls/:callSid', { preHandler: requireApiKey }, async (request, reply) => {
  const call = store.getCall(request.params.callSid);
  if (!call) return reply.status(404).send({ error: 'Call not found' });
  return call;
});

fastify.get('/api/leads', { preHandler: requireApiKey }, async (request) => {
  const limit = Math.min(Number(request.query?.limit) || 100, 500);
  return { leads: store.listLeads({ limit, stage: request.query?.stage }) };
});

fastify.get('/api/events', { preHandler: requireApiKey }, async (request) => {
  const limit = Math.min(Number(request.query?.limit) || 100, 500);
  return { events: store.listEvents({ limit, type: request.query?.type }) };
});

fastify.get('/api/analytics', { preHandler: requireApiKey }, async () => {
  const events = store.listEvents({ limit: 500 });
  const calls = store.listCalls({ limit: 200 });
  const leads = store.listLeads({ limit: 500 });
  return buildAnalyticsSummary({ events, calls, leads });
});

/* ====================================================================
   OUTBOUND CALLS
   ==================================================================== */
fastify.post('/api/unmark-dnc', async (request, reply) => {
  const phone = normalizePhone(request.body?.phone || request.query?.phone);
  if (!phone) return reply.status(400).send({ error: 'phone is required' });
  store.unmarkDoNotCall(phone);
  return { success: true, message: `Removed ${phone} from Do Not Call list`, phone };
});

fastify.post('/api/call-usa-client', { preHandler: requireApiKey }, async (request, reply) => {
  if (!enforceRateLimit(request, reply)) return;

  const body = request.body || {};
  const targetPhoneNumber = normalizePhone(body.targetPhoneNumber);
  const clientName = body.clientName || 'Business Owner';
  const industry = body.industry || 'Local Business';
  const weakness = body.weakness || 'no interactive appointment or quote request system';
  const demoUrl = body.demoUrl || DEFAULT_DEMO_URL;

  if (!body.targetPhoneNumber || !isValidPhone(body.targetPhoneNumber)) {
    return reply.status(400).send({
      error: 'targetPhoneNumber is required in E.164 form (+1xxxxxxxxxx)'
    });
  }

  if (store.isDoNotCall(targetPhoneNumber)) {
    return reply.status(403).send({ error: 'Number is on do-not-call list', phone: targetPhoneNumber });
  }

  const lead = {
    targetPhoneNumber,
    clientName,
    industry,
    industryKey: resolveIndustry(industry),
    weakness,
    demoUrl,
    callType: 'cold-outbound',
    stage: 'queued',
    packageId: body.packageId || process.env.DEFAULT_PACKAGE || 'starter',
    invoiceUrl: body.invoiceUrl || process.env.INVOICE_URL,
    paymentUrl: body.paymentUrl || process.env.PAYMENT_URL
  };

  store.upsertLead(targetPhoneNumber, {
    clientName,
    industry,
    demoUrl,
    stage: 'queued'
  });

  if (!twilioClient) {
    return reply.status(503).send({
      error: 'Twilio credentials not configured in .env',
      simulationMode: true,
      message: `Would initiate outbound call to ${targetPhoneNumber} for ${clientName} (${industry})`,
      next: 'Set TWILIO_* or use POST /api/funnel/simulate to test demo→pay→onboard without calls',
      promptPreview: getUniversalPitch(lead).slice(0, 400) + '...',
      lead
    });
  }

  try {
    const call = await placeOutboundCall({ to: targetPhoneNumber, lead });
    store.addEvent({
      type: 'CALL_STARTED',
      callSid: call.sid,
      phone: targetPhoneNumber,
      callType: 'cold-outbound',
      clientName,
      industry
    });
    await notifier.notifyOwner('call_started', { ...lead, callSid: call.sid, stage: 'called' });
    return { success: true, callSid: call.sid, status: call.status, lead };
  } catch (err) {
    fastify.log.error(err, 'Twilio outbound call error');
    return reply.status(500).send({ error: err.message });
  }
});

fastify.post('/api/follow-up-call', { preHandler: requireApiKey }, async (request, reply) => {
  if (!enforceRateLimit(request, reply)) return;

  const body = request.body || {};
  const targetPhoneNumber = normalizePhone(body.targetPhoneNumber);
  if (!body.targetPhoneNumber || !isValidPhone(body.targetPhoneNumber)) {
    return reply.status(400).send({ error: 'targetPhoneNumber is required' });
  }
  if (store.isDoNotCall(targetPhoneNumber)) {
    return reply.status(403).send({ error: 'Number is on do-not-call list', phone: targetPhoneNumber });
  }

  const lead = {
    targetPhoneNumber,
    clientName: body.clientName || 'Business Owner',
    industry: body.industry || 'Local Business',
    demoUrl: body.demoUrl || DEFAULT_DEMO_URL,
    invoiceUrl: body.invoiceUrl || process.env.INVOICE_URL,
    paymentUrl: body.paymentUrl || process.env.PAYMENT_URL,
    packageId: body.packageId || 'starter',
    callType: 'follow-up',
    stage: 'follow_up_queued'
  };

  if (!twilioClient) {
    return reply.status(503).send({
      error: 'Twilio not configured',
      simulationMode: true,
      systemPrompt: getFollowUpPitch(lead),
      message: `Would follow-up call ${targetPhoneNumber}`
    });
  }

  try {
    const call = await placeOutboundCall({ to: targetPhoneNumber, lead });
    store.addEvent({
      type: 'CALL_STARTED',
      callSid: call.sid,
      phone: targetPhoneNumber,
      callType: 'follow-up',
      clientName: lead.clientName
    });
    return { success: true, callSid: call.sid, callType: 'follow-up', status: call.status };
  } catch (err) {
    fastify.log.error(err, 'Follow-up call error');
    return reply.status(500).send({ error: err.message });
  }
});

/* ====================================================================
   TWIML + STATUS
   ==================================================================== */
fastify.all('/twiml-outbound', { preHandler: requireTwilioSignature }, async (request, reply) => {
  const callSid = request.body?.CallSid || request.query?.CallSid;
  const toNumber = request.body?.To || request.query?.To;
  const fromNumber = request.body?.From || request.query?.From;
  const answeredBy = request.body?.AnsweredBy || request.query?.AnsweredBy;
  fastify.log.info(`TwiML outbound for call: ${callSid} to=${toNumber} from=${fromNumber}`);

  // AMD: hang up early on machines when enabled
  const isMachine =
    answeredBy &&
    /machine|fax/i.test(String(answeredBy)) &&
    process.env.HANGUP_ON_MACHINE !== 'false';
  if (isMachine && process.env.MACHINE_DETECTION === 'true') {
    if (callSid) {
      store.setCall(callSid, {
        ...(store.getCall(callSid) || {}),
        callSid,
        status: 'machine',
        answeredBy,
        stage: 'machine_detected'
      });
      store.addEvent({ type: 'machine_detected', callSid, answeredBy });
    }
    reply.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`);
    return;
  }

  // Store To number so SMS actions have a destination phone
  if (callSid) {
    const existing = store.getCall(callSid) || {};
    const normalizedTo = normalizePhone(toNumber) || toNumber || existing.targetPhoneNumber;
    store.setCall(callSid, {
      ...existing,
      callSid,
      targetPhoneNumber: normalizedTo,
      fromNumber: fromNumber || existing.fromNumber,
      direction: 'outbound',
      status: 'ringing',
      answeredBy: answeredBy || existing.answeredBy,
      actionsFired: existing.actionsFired || {}
    });
  }

  reply.type('text/xml').send(twimlStream(callSid));
});

fastify.all('/twiml-inbound', { preHandler: requireTwilioSignature }, async (request, reply) => {
  const callSid = request.body?.CallSid || request.query?.CallSid;
  const from = request.body?.From || request.query?.From;
  const to = request.body?.To || request.query?.To;
  const fromNorm = normalizePhone(from) || from;

  // Respect DNC on inbound callback SMS targets (still answer, but flag)
  if (fromNorm && store.isDoNotCall(fromNorm)) {
    fastify.log.info(`Inbound from DNC number ${fromNorm} — polite decline`);
    reply.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We're unable to take this call right now. Goodbye.</Say>
  <Hangup/>
</Response>`);
    return;
  }

  const receptionist = store.findReceptionist({ toNumber: to });
  if (!receptionist) {
    fastify.log.warn(`No receptionist configured for To=${to}`);
    reply.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for calling. Our virtual assistant is not configured for this line yet. Please try again later.</Say>
  <Hangup/>
</Response>`);
    return;
  }

  store.setCall(callSid, {
    ...receptionist,
    callSid,
    type: 'inbound-receptionist',
    callType: 'inbound',
    fromNumber: fromNorm,
    targetPhoneNumber: fromNorm,
    toNumber: to,
    direction: 'inbound',
    status: 'ringing',
    stage: 'inbound',
    actionsFired: {}
  });

  store.addEvent({
    type: 'inbound_call',
    callSid,
    from: fromNorm,
    to,
    clientName: receptionist.clientName
  });
  reply.type('text/xml').send(twimlStream(callSid, { to, from: fromNorm }));
});

fastify.all('/call-status', { preHandler: requireTwilioSignature }, async (request, reply) => {
  const { CallSid, CallStatus, CallDuration, From, To, AnsweredBy } = request.body || {};
  fastify.log.info(`Call status — SID: ${CallSid}, Status: ${CallStatus}`);
  if (CallSid) {
    const existing = store.getCall(CallSid) || {};
    const terminal = ['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(CallStatus);
    store.setCall(CallSid, {
      ...existing,
      status: CallStatus,
      duration: CallDuration ? Number(CallDuration) : existing.duration,
      fromNumber: From || existing.fromNumber,
      toNumber: To || existing.toNumber,
      answeredBy: AnsweredBy || existing.answeredBy,
      ...(terminal ? { endedAt: new Date().toISOString() } : {})
    });
    store.addEvent({
      type: 'call_status',
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration,
      answeredBy: AnsweredBy
    });

    // AMD hangup via REST if status callback reports machine (when AMD async)
    if (
      twilioClient &&
      AnsweredBy &&
      /machine|fax/i.test(String(AnsweredBy)) &&
      process.env.MACHINE_DETECTION === 'true' &&
      process.env.HANGUP_ON_MACHINE !== 'false' &&
      !terminal
    ) {
      try {
        await twilioClient.calls(CallSid).update({ status: 'completed' });
        store.addEvent({ type: 'machine_hangup', callSid: CallSid, answeredBy: AnsweredBy });
      } catch (err) {
        fastify.log.warn?.({ err }, 'machine hangup failed');
      }
    }

    if (terminal) {
      eventBus.emit('CALL_ENDED', {
        callSid: CallSid,
        status: CallStatus,
        duration: CallDuration,
        phone: existing.targetPhoneNumber || To || From
      });
      conversationManagers.delete(CallSid);
      conversationMemory.delete(CallSid);
    }
  }
  reply.send({ received: true });
});

/* ====================================================================
   MEDIA STREAM
   ==================================================================== */
fastify.register(async (instance) => {
  instance.get('/media-stream', { websocket: true }, (connection) => {
    fastify.log.info('Twilio Media Stream WebSocket connected');
    attachMediaStreamHandler(connection, {
      log: fastify.log,
      processTranscript: (text, lead, meta) => processCallTranscript(text, lead, meta)
    });
  });
});

/* ====================================================================
   FUNNEL SMS APIs
   ==================================================================== */
fastify.post('/api/send-demo-sms', { preHandler: requireApiKey }, async (request, reply) => {
  if (!enforceRateLimit(request, reply)) return;

  const body = request.body || {};
  const targetPhoneNumber = normalizePhone(body.targetPhoneNumber);
  if (!targetPhoneNumber) return reply.status(400).send({ error: 'targetPhoneNumber is required' });

  const lead = {
    targetPhoneNumber,
    clientName: body.clientName,
    industry: body.industry,
    demoUrl: body.demoUrl || DEFAULT_DEMO_URL,
    actionsFired: {}
  };

  try {
    const result = await actions.handleAction('SEND_DEMO_SMS', lead);
    return { success: true, result, preview: buildDemoSms(lead) };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.post('/api/send-payment-sms', { preHandler: requireApiKey }, async (request, reply) => {
  if (!enforceRateLimit(request, reply)) return;

  const body = request.body || {};
  const targetPhoneNumber = normalizePhone(body.targetPhoneNumber);
  if (!targetPhoneNumber) return reply.status(400).send({ error: 'targetPhoneNumber is required' });

  const packageId = body.packageId || 'starter';
  const lead = {
    targetPhoneNumber,
    clientName: body.clientName,
    industry: body.industry,
    demoUrl: body.demoUrl || DEFAULT_DEMO_URL,
    paymentUrl: body.paymentUrl,
    packageId,
    actionsFired: {}
  };

  try {
    const result = await actions.handleAction('SEND_PAYMENT', lead, { packageId });
    return {
      success: true,
      result,
      package: getPackage(packageId),
      onboardingUrl: result.onboardingToken ? onboardingUrl(result.onboardingToken) : null,
      preview: result.body || buildPaymentSms({ ...lead, onboardingToken: result.onboardingToken }, packageId)
    };
  } catch (err) {
    return reply.status(500).send({ error: err.message });
  }
});

/**
 * Full funnel dry-run without Twilio/OpenAI voice.
 * Stages: lead → demo_sms → payment_sms → onboarding token
 */
fastify.post('/api/funnel/simulate', { preHandler: requireApiKey }, async (request, reply) => {
  if (!enforceRateLimit(request, reply)) return;

  const body = request.body || {};
  const phone = normalizePhone(body.targetPhoneNumber || '+12145550188');
  if (!phone) return reply.status(400).send({ error: 'invalid phone' });

  const lead = {
    targetPhoneNumber: phone,
    clientName: body.clientName || 'Demo Plumbing Co',
    industry: body.industry || 'plumbing',
    demoUrl: body.demoUrl || DEFAULT_DEMO_URL,
    packageId: body.packageId || 'starter',
    callSid: `SIM_${Date.now()}`,
    stage: 'simulated',
    actionsFired: {}
  };

  store.setCall(lead.callSid, lead);
  store.upsertLead(phone, { ...lead, phone, stage: 'simulated' });

  const demo = await actions.handleAction('SEND_DEMO_SMS', { ...lead, actionsFired: {} });
  const pay = await actions.handleAction('SEND_PAYMENT', {
    ...lead,
    smsSent: true,
    actionsFired: { SEND_DEMO_SMS: new Date().toISOString() }
  }, { packageId: lead.packageId });

  const token = pay.onboardingToken;
  return {
    success: true,
    message: 'Funnel simulated end-to-end (no real call/SMS unless Twilio configured)',
    stages: {
      1: 'lead_created',
      2: 'demo_sms',
      3: 'payment_sms + onboarding_token',
      4: 'open onboarding URL and submit form'
    },
    lead: store.getLead(phone),
    demo,
    payment: pay,
    onboardingUrl: token ? onboardingUrl(token) : null,
    package: getPackage(lead.packageId),
    ownerNotifyConfigured: Boolean(process.env.OWNER_NOTIFY_PHONE || process.env.OWNER_WEBHOOK_URL),
    voiceReady: Boolean(resolveRealtimeConfig()?.ready),
    twilioReady: Boolean(twilioClient)
  };
});

/* ====================================================================
   ONBOARDING FORM (public token links)
   ==================================================================== */
const ONBOARD_HTML = path.join(__dirname, 'public', 'onboard.html');

fastify.get('/onboard/:token', async (request, reply) => {
  if (!fs.existsSync(ONBOARD_HTML)) {
    return reply.status(500).send('onboard.html missing');
  }
  const html = fs.readFileSync(ONBOARD_HTML, 'utf8');
  reply.type('text/html').send(html);
});

fastify.get('/api/onboard/:token', async (request, reply) => {
  const rec = store.getOnboarding(request.params.token);
  if (!rec) return reply.status(404).send({ error: 'Invalid onboarding token' });
  if (rec.status === 'expired') return reply.status(410).send({ error: 'expired', status: 'expired' });
  return {
    token: rec.token,
    status: rec.status,
    packageId: rec.packageId,
    clientName: rec.clientName,
    industry: rec.industry,
    phone: rec.phone,
    receptionistConfigKey: rec.receptionistConfigKey || null
  };
});

fastify.post('/api/onboard/:token/submit', async (request, reply) => {
  const token = request.params.token;
  const rec = store.getOnboarding(token);
  if (!rec) return reply.status(404).send({ error: 'Invalid onboarding token' });
  if (rec.status === 'expired') return reply.status(410).send({ error: 'Link expired' });
  if (rec.status === 'completed') {
    return {
      success: true,
      alreadyCompleted: true,
      clientName: rec.clientName,
      configKey: rec.receptionistConfigKey
    };
  }

  const body = request.body || {};
  try {
    // CRITICAL: never use lead personal phone (rec.phone) as Twilio DID.
    // Receptionist routing must use an explicit Twilio / forwarding number from the form.
    const twilioPhoneNumber = body.twilioPhoneNumber
      ? normalizePhone(body.twilioPhoneNumber) || body.twilioPhoneNumber
      : null;

    const setup = setupReceptionistFromBody({
      clientName: body.clientName || rec.clientName,
      industry: body.industry || rec.industry || 'local business',
      ownerName: body.ownerName,
      services: body.services,
      businessHours: body.businessHours,
      bookingUrl: body.bookingUrl,
      emergencyProtocol: body.emergencyProtocol,
      twilioPhoneNumber,
      ownerPhone: body.ownerPhone
        ? normalizePhone(body.ownerPhone) || body.ownerPhone
        : null,
      customInstructions: body.customInstructions,
      pricingNotes: body.pricingNotes
    });

    store.completeOnboarding(
      token,
      {
        clientName: setup.config.clientName,
        industry: setup.config.industry,
        twilioPhoneNumber: setup.normalizedTwilio,
        ownerPhone: setup.config.ownerPhone
      },
      setup.configKey
    );

    await notifier.notifyOwner('onboarding_completed', {
      clientName: setup.config.clientName,
      industry: setup.config.industry,
      targetPhoneNumber: rec.phone,
      stage: 'live',
      packageId: rec.packageId
    }, { configKey: setup.configKey });

    return {
      success: true,
      clientName: setup.config.clientName,
      configKey: setup.configKey,
      voiceWebhook: setup.voiceWebhook,
      statusCallback: setup.statusCallback,
      message: 'AI Receptionist configured — point Twilio voice URL to voiceWebhook'
    };
  } catch (err) {
    return reply.status(err.statusCode || 500).send({ error: err.message });
  }
});

/* ====================================================================
   RECEPTIONIST SETUP (operator API)
   ==================================================================== */
fastify.post(
  '/api/setup-inbound-receptionist',
  { preHandler: requireApiKey },
  async (request, reply) => {
    try {
      const setup = setupReceptionistFromBody(request.body || {});
      fastify.log.info(`[RECEPTIONIST] ${setup.config.clientName} key=${setup.configKey}`);
      return {
        success: true,
        message: `AI Receptionist configured for ${setup.config.clientName}`,
        configKey: setup.configKey,
        twilioPhoneNumber: setup.normalizedTwilio,
        voiceWebhook: setup.voiceWebhook,
        statusCallback: setup.statusCallback,
        promptPreview: setup.receptionistPrompt.substring(0, 300) + '...'
      };
    } catch (err) {
      return reply.status(err.statusCode || 500).send({ error: err.message });
    }
  }
);

fastify.get('/api/receptionists', { preHandler: requireApiKey }, async () => ({
  receptionists: store.listReceptionists()
}));

/* ====================================================================
   INDUSTRIES / DNC / PROMPT PREVIEW
   ==================================================================== */
fastify.get('/api/industries', async () => {
  const industries = Object.keys(INDUSTRY_DB)
    .filter((k) => k !== 'default')
    .map((key) => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      hook: INDUSTRY_DB[key].hook.substring(0, 120) + '...',
      hasAutomation: true
    }));
  return { industries, total: industries.length };
});

fastify.post('/api/do-not-call', { preHandler: requireApiKey }, async (request, reply) => {
  const phone = normalizePhone(request.body?.phone || request.body?.targetPhoneNumber);
  if (!phone) return reply.status(400).send({ error: 'phone is required' });
  store.markDoNotCall(phone, request.body?.reason || 'manual');
  return { success: true, phone };
});

fastify.get('/api/prompt-preview', { preHandler: requireApiKey }, async (request) => {
  const mode = (request.query?.mode || 'cold').toLowerCase();
  const lead = {
    clientName: request.query?.clientName || 'Sample Business',
    industry: request.query?.industry || 'plumbing',
    weakness: request.query?.weakness,
    demoUrl: request.query?.demoUrl || DEFAULT_DEMO_URL
  };
  let prompt;
  if (mode === 'follow-up' || mode === 'followup') prompt = getFollowUpPitch(lead);
  else if (mode === 'inbound') prompt = getInboundPitch(lead);
  else prompt = getUniversalPitch(lead);
  return { mode, lead, prompt, length: prompt.length };
});

/* ====================================================================
   START
   ==================================================================== */
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    const r = buildReadiness();
    const rt = r.realtime;
    const tick = (ok) => (ok ? '✓' : '·');
    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║  🇺🇸  USA AI CALLER  v${APP_VERSION}  ·  ${r.status.toUpperCase().padEnd(8)}  ${r.score.padStart(4)} ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║  ${tick(r.twilioOk)} Twilio     ${r.twilioOk ? 'LIVE          ' : 'simulation    '}  ${tick(r.voiceOk)} Voice  ${(rt?.path === 'hybrid' ? 'groq-eleven' : (rt?.path || 'none')).padEnd(12)} ║`);
    console.log(`║  ${tick(r.ownerOk)} Owner SMS  ${r.ownerOk ? 'on            ' : 'off           '}  ${tick(r.authOk)} API key ${r.authOk ? 'on          ' : 'off (dev)   '} ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║  Local   http://localhost:${String(PORT).padEnd(5)} /health              ║`);
    console.log(`║  Public  ${PUBLIC_HOSTNAME.slice(0, 42).padEnd(42)} ║`);
    if (rt?.ready && rt.path === 'hybrid') {
      console.log(`║  Groq    Whisper → ${String(rt.model || '').slice(0, 22).padEnd(22)} → Eleven ║`);
    } else if (rt?.ready) {
      console.log(`║  Engine  ${String(rt.provider + ' / ' + (rt.model || '')).slice(0, 42).padEnd(42)} ║`);
    } else if (rt?.blockers?.length) {
      for (const b of rt.blockers.slice(0, 2)) {
        console.log(`║  ! ${String(b).slice(0, 48).padEnd(48)} ║`);
      }
    }
    const agentLine = `  Agent   ${AGENT_NAME} @ ${COMPANY_NAME}`.slice(0, 52);
    console.log(`║${agentLine.padEnd(54)}║`);
    console.log(`╚══════════════════════════════════════════════════════╝\n`);
    if (!r.authOk) {
      console.log('  ⚠  API_KEY empty — set it before exposing this host publicly.\n');
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

async function shutdown(signal) {
  fastify.log.info(`Shutting down (${signal})...`);
  try {
    // Flush debounced JSON store so last call/events are not lost
    if (typeof store.flush === 'function') store.flush();
  } catch (err) {
    fastify.log.warn?.({ err }, 'store flush failed');
  }
  try {
    await fastify.close();
  } catch (err) {
    fastify.log.error(err);
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  fastify.log.error(err, 'uncaughtException');
  try {
    if (typeof store.flush === 'function') store.flush();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  fastify.log.error(err, 'unhandledRejection');
});

start();
