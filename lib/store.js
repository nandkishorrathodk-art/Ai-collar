/**
 * Lightweight JSON file store for calls, leads, receptionists, onboarding tokens.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULT_STATE = {
  calls: {},
  leads: {},
  receptionists: {},
  onboarding: {},
  appointments: [],
  events: [],
  doNotCall: {},
  conversations: {},
  updatedAt: null
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) return structuredClone(DEFAULT_STATE);
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function save(state) {
  ensureDataDir();
  state.updatedAt = new Date().toISOString();
  if (Array.isArray(state.events) && state.events.length > 500) {
    state.events = state.events.slice(-500);
  }
  // Debounced async write — prevents blocking event loop during live calls
  if (save._timer) clearTimeout(save._timer);
  save._pending = state;
  save._timer = setTimeout(async () => {
    const data = JSON.stringify(save._pending, null, 2);
    const tmpFile = STORE_FILE + '.tmp';
    try {
      // Atomic write: write to temp then rename — prevents corruption on crash
      await fs.promises.writeFile(tmpFile, data, 'utf8');
      // Backup previous store
      if (fs.existsSync(STORE_FILE)) {
        const backupFile = STORE_FILE + '.bak';
        try { await fs.promises.copyFile(STORE_FILE, backupFile); } catch { /* ignore */ }
      }
      await fs.promises.rename(tmpFile, STORE_FILE);
    } catch (err) {
      // Fallback: direct write if rename fails (Windows lock)
      try { await fs.promises.writeFile(STORE_FILE, data, 'utf8'); } catch { /* ignore */ }
    }
  }, 2000);
}
save._timer = null;
save._pending = null;

// Flush pending writes immediately (called on shutdown)
function flushSync(state) {
  if (save._timer) {
    clearTimeout(save._timer);
    save._timer = null;
  }
  state.updatedAt = new Date().toISOString();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch { /* ignore on shutdown */ }
}

class Store {
  constructor() {
    this.state = load();
    this.active = new Map();
  }

  setCall(callSid, data) {
    if (!callSid) return data;
    const existing = this.state.calls[callSid] || this.active.get(callSid) || {};
    const merged = {
      ...existing,
      ...data,
      callSid,
      updatedAt: new Date().toISOString()
    };
    if (!merged.createdAt) merged.createdAt = merged.updatedAt;
    this.state.calls[callSid] = merged;
    this.active.set(callSid, merged);
    this._indexLead(merged);
    save(this.state);
    return merged;
  }

  getCall(callSid) {
    if (!callSid) return null;
    return this.active.get(callSid) || this.state.calls[callSid] || null;
  }

  updateCallStatus(callSid, status) {
    if (!callSid) return null;
    const call = this.getCall(callSid) || { callSid };
    call.status = status;
    call.updatedAt = new Date().toISOString();
    if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(status)) {
      call.endedAt = call.updatedAt;
    }
    return this.setCall(callSid, call);
  }

  listCalls({ limit = 50, status } = {}) {
    let rows = Object.values(this.state.calls);
    if (status) rows = rows.filter((c) => c.status === status);
    rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return rows.slice(0, limit);
  }

  _indexLead(call) {
    if (!call?.targetPhoneNumber) return;
    const key = call.targetPhoneNumber;
    const prev = this.state.leads[key] || {};
    this.state.leads[key] = {
      ...prev,
      phone: key,
      clientName: call.clientName || prev.clientName,
      industry: call.industry || prev.industry,
      demoUrl: call.demoUrl || prev.demoUrl,
      lastCallSid: call.callSid || prev.lastCallSid,
      lastCallType: call.callType || call.type || prev.lastCallType,
      lastStatus: call.status || prev.lastStatus,
      stage: call.stage || prev.stage || 'new',
      smsSent: call.smsSent ?? prev.smsSent,
      paymentSmsSent: call.paymentSmsSent ?? prev.paymentSmsSent,
      packageId: call.packageId || prev.packageId,
      onboardingToken: call.onboardingToken || prev.onboardingToken,
      dealClosed: call.dealClosed ?? prev.dealClosed,
      doNotCall: this.state.doNotCall[key] || prev.doNotCall || false,
      updatedAt: new Date().toISOString(),
      createdAt: prev.createdAt || new Date().toISOString()
    };
  }

  upsertLead(phone, data = {}) {
    if (!phone) return null;
    const prev = this.state.leads[phone] || { phone, createdAt: new Date().toISOString() };
    this.state.leads[phone] = {
      ...prev,
      ...data,
      phone,
      updatedAt: new Date().toISOString()
    };
    save(this.state);
    return this.state.leads[phone];
  }

  setLeadStage(phone, stage, extra = {}) {
    if (!phone) return null;
    return this.upsertLead(phone, { ...extra, stage });
  }

  getLead(phone) {
    return this.state.leads[phone] || null;
  }

  listLeads({ limit = 100, stage } = {}) {
    let rows = Object.values(this.state.leads);
    if (stage) rows = rows.filter((l) => l.stage === stage);
    return rows
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, limit);
  }

  markDoNotCall(phone, reason = 'requested') {
    if (!phone) return;
    this.state.doNotCall[phone] = { phone, reason, at: new Date().toISOString() };
    if (this.state.leads[phone]) {
      this.state.leads[phone].doNotCall = true;
      this.state.leads[phone].stage = 'do_not_call';
      this.state.leads[phone].updatedAt = new Date().toISOString();
    }
    this.addEvent({ type: 'do_not_call', phone, reason });
    save(this.state);
  }

  isDoNotCall(phone) {
    return Boolean(this.state.doNotCall[phone]);
  }

  unmarkDoNotCall(phone) {
    if (!phone) return;
    delete this.state.doNotCall[phone];
    if (this.state.leads[phone]) {
      this.state.leads[phone].doNotCall = false;
      if (this.state.leads[phone].stage === 'do_not_call') {
        this.state.leads[phone].stage = 'queued';
      }
      this.state.leads[phone].updatedAt = new Date().toISOString();
    }
    this.addEvent({ type: 'unmark_do_not_call', phone });
    save(this.state);
  }

  setReceptionist(key, config) {
    this.state.receptionists[key] = {
      ...config,
      configKey: key,
      updatedAt: new Date().toISOString(),
      createdAt: this.state.receptionists[key]?.createdAt || new Date().toISOString()
    };
    save(this.state);
    return this.state.receptionists[key];
  }

  getReceptionist(key) {
    return this.state.receptionists[key] || null;
  }

  findReceptionist({ toNumber, configKey } = {}) {
    if (configKey && this.state.receptionists[configKey]) {
      return this.state.receptionists[configKey];
    }
    if (toNumber) {
      const digits = String(toNumber).replace(/\D/g, '');
      for (const cfg of Object.values(this.state.receptionists)) {
        const phoneDigits = String(cfg.twilioPhoneNumber || '').replace(/\D/g, '');
        if (phoneDigits && phoneDigits === digits) return cfg;
        if (cfg.configKey && cfg.configKey.includes(digits)) return cfg;
      }
    }
    return null;
  }

  listReceptionists() {
    return Object.values(this.state.receptionists);
  }

  /**
   * Create onboarding token for a lead (60-sec client form after payment intent).
   */
  createOnboardingToken(lead = {}, { packageId = 'starter', ttlHours = 72 } = {}) {
    const token = crypto.randomBytes(16).toString('hex');
    const record = {
      token,
      packageId,
      phone: lead.targetPhoneNumber || lead.phone || null,
      clientName: lead.clientName || '',
      industry: lead.industry || '',
      callSid: lead.callSid || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000).toISOString()
    };
    this.state.onboarding[token] = record;
    if (record.phone) {
      this.upsertLead(record.phone, {
        onboardingToken: token,
        packageId,
        stage: lead.stage || 'payment_sent'
      });
    }
    save(this.state);
    return record;
  }

  getOnboarding(token) {
    const rec = this.state.onboarding[token];
    if (!rec) return null;
    if (rec.expiresAt && new Date(rec.expiresAt).getTime() < Date.now()) {
      rec.status = 'expired';
    }
    return rec;
  }

  completeOnboarding(token, formData, receptionistConfigKey) {
    const rec = this.state.onboarding[token];
    if (!rec) return null;
    rec.status = 'completed';
    rec.completedAt = new Date().toISOString();
    rec.formData = formData;
    rec.receptionistConfigKey = receptionistConfigKey;
    if (rec.phone) {
      this.upsertLead(rec.phone, {
        stage: 'live',
        onboardedAt: rec.completedAt,
        receptionistConfigKey
      });
    }
    save(this.state);
    return rec;
  }

  listOnboarding({ limit = 50 } = {}) {
    return Object.values(this.state.onboarding)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, limit);
  }

  upsertConversation(callSid, payload = {}) {
    if (!callSid) return null;
    const prev = this.state.conversations[callSid] || {};
    const next = {
      ...prev,
      ...payload,
      callSid,
      updatedAt: new Date().toISOString()
    };
    this.state.conversations[callSid] = next;
    save(this.state);
    return next;
  }

  getConversation(callSid) {
    return this.state.conversations[callSid] || null;
  }

  getConversationSummary(callSid) {
    const rec = this.getConversation(callSid);
    if (!rec) return null;
    return {
      stage: rec.stage || 'intro',
      emotion: rec.emotion || 'neutral',
      intent: rec.intent || rec.lastIntent || 'intro',
      leadScore: rec.leadScore || 0,
      objections: Array.isArray(rec.objections) ? rec.objections : [],
      history: Array.isArray(rec.history) ? rec.history : [],
      toolsExecuted: Array.isArray(rec.toolsExecuted) ? rec.toolsExecuted : [],
      pendingActions: Array.isArray(rec.pendingActions) ? rec.pendingActions : [],
      summary: rec.summary || ''
    };
  }

  listConversations({ limit = 100 } = {}) {
    return Object.values(this.state.conversations)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, limit);
  }

  addEvent(event) {
    this.state.events.push({
      ...event,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString()
    });
    if (this.state.events.length > 500) this.state.events = this.state.events.slice(-500);
    save(this.state);
  }

  listEvents({ limit = 100, type } = {}) {
    let rows = [...this.state.events].reverse();
    if (type) rows = rows.filter((e) => e.type === type);
    return rows.slice(0, limit);
  }

  addAppointment(record) {
    if (!Array.isArray(this.state.appointments)) this.state.appointments = [];
    record.createdAt = record.createdAt || new Date().toISOString();
    this.state.appointments.push(record);
    if (this.state.appointments.length > 200) this.state.appointments = this.state.appointments.slice(-200);
    save(this.state);
    return record;
  }

  getAppointment(id) {
    if (!Array.isArray(this.state.appointments)) return null;
    return this.state.appointments.find((a) => a.id === id) || null;
  }

  listAppointments({ limit = 50 } = {}) {
    if (!Array.isArray(this.state.appointments)) return [];
    return [...this.state.appointments]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, limit);
  }

  stats() {
    const calls = Object.values(this.state.calls);
    const leads = Object.values(this.state.leads);
    const byStage = {};
    for (const l of leads) {
      const s = l.stage || 'unknown';
      byStage[s] = (byStage[s] || 0) + 1;
    }
    return {
      totalCalls: calls.length,
      activeCalls: [...this.active.values()].filter((c) =>
        ['initiated', 'ringing', 'in-progress', 'answered'].includes(c.status)
      ).length,
      completedCalls: calls.filter((c) => c.status === 'completed').length,
      totalLeads: leads.length,
      leadsByStage: byStage,
      smsSent: leads.filter((l) => l.smsSent).length,
      paymentSmsSent: leads.filter((l) => l.paymentSmsSent).length,
      dealsClosed: leads.filter((l) => l.dealClosed).length,
      liveClients: leads.filter((l) => l.stage === 'live').length,
      doNotCall: Object.keys(this.state.doNotCall).length,
      receptionists: Object.keys(this.state.receptionists).length,
      pendingOnboarding: Object.values(this.state.onboarding).filter((o) => o.status === 'pending')
        .length,
      updatedAt: this.state.updatedAt
    };
  }

  /**
   * Cleanup calls stuck in 'in-progress' after a timeout.
   * Called periodically to prevent phantom active calls.
   */
  cleanupStaleCalls(maxAgeMs = 30 * 60 * 1000) {
    const now = Date.now();
    let cleaned = 0;
    const activeStatuses = ['initiated', 'ringing', 'in-progress', 'answered'];
    for (const [callSid, call] of Object.entries(this.state.calls)) {
      if (!activeStatuses.includes(call.status)) continue;
      const updatedAt = call.updatedAt ? new Date(call.updatedAt).getTime() : 0;
      if (now - updatedAt > maxAgeMs) {
        call.status = 'timeout';
        call.endedAt = new Date().toISOString();
        call.updatedAt = call.endedAt;
        call.stage = call.stage === 'in_call' ? 'call_timeout' : call.stage;
        this.active.delete(callSid);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.addEvent({ type: 'stale_cleanup', cleaned, maxAgeMs });
      save(this.state);
    }
    return cleaned;
  }

  /**
   * Get currently active calls.
   */
  getActiveCalls() {
    const activeStatuses = ['initiated', 'ringing', 'in-progress', 'answered'];
    return Object.values(this.state.calls)
      .filter(c => activeStatuses.includes(c.status))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  /**
   * Aggregated dashboard stats for admin UI.
   */
  getDashboardStats() {
    const calls = Object.values(this.state.calls);
    const leads = Object.values(this.state.leads);
    const events = [...this.state.events].reverse();
    const receptionists = Object.values(this.state.receptionists);
    const onboarding = Object.values(this.state.onboarding);

    // Calls breakdown
    const callsByStatus = {};
    const callsByType = {};
    const callsByIndustry = {};
    let totalDuration = 0;
    let callsWithDuration = 0;

    for (const c of calls) {
      const status = c.status || 'unknown';
      callsByStatus[status] = (callsByStatus[status] || 0) + 1;
      const type = c.callType || c.type || 'unknown';
      callsByType[type] = (callsByType[type] || 0) + 1;
      if (c.industry) {
        callsByIndustry[c.industry] = (callsByIndustry[c.industry] || 0) + 1;
      }
      if (c.analytics?.durationSec) {
        totalDuration += c.analytics.durationSec;
        callsWithDuration++;
      } else if (c.duration) {
        totalDuration += Number(c.duration);
        callsWithDuration++;
      }
    }

    // Leads pipeline
    const leadsByStage = {};
    for (const l of leads) {
      const s = l.stage || 'unknown';
      leadsByStage[s] = (leadsByStage[s] || 0) + 1;
    }

    // Recent events (last 20)
    const recentEvents = events.slice(0, 20);

    // SMS stats
    const smsEvents = events.filter(e => e.type === 'SMS_SENT');
    const smsByTemplate = {};
    for (const e of smsEvents) {
      const t = e.template || 'unknown';
      smsByTemplate[t] = (smsByTemplate[t] || 0) + 1;
    }

    // Conversion funnel
    const funnel = {
      totalLeads: leads.length,
      queued: leadsByStage['queued'] || 0,
      called: (leadsByStage['in_call'] || 0) + (leadsByStage['called'] || 0),
      demoSent: leadsByStage['demo_sent'] || 0,
      paymentSent: leadsByStage['payment_sent'] || 0,
      dealClosed: leadsByStage['deal_closed'] || 0,
      live: leadsByStage['live'] || 0,
      doNotCall: leadsByStage['do_not_call'] || 0
    };

    return {
      overview: {
        totalCalls: calls.length,
        activeCalls: this.getActiveCalls().length,
        completedCalls: callsByStatus['completed'] || 0,
        failedCalls: (callsByStatus['failed'] || 0) + (callsByStatus['timeout'] || 0),
        totalLeads: leads.length,
        dealsClosed: leads.filter(l => l.dealClosed).length,
        liveClients: leadsByStage['live'] || 0,
        smsSent: leads.filter(l => l.smsSent).length,
        receptionists: receptionists.length,
        pendingOnboarding: onboarding.filter(o => o.status === 'pending').length,
        avgCallDuration: callsWithDuration > 0 ? Math.round(totalDuration / callsWithDuration) : 0
      },
      callsByStatus,
      callsByType,
      callsByIndustry,
      funnel,
      smsByTemplate,
      recentEvents,
      recentCalls: calls
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        .slice(0, 25)
        .map(c => ({
          callSid: c.callSid,
          status: c.status,
          stage: c.stage,
          clientName: c.clientName,
          industry: c.industry,
          targetPhoneNumber: c.targetPhoneNumber,
          callType: c.callType || c.type,
          direction: c.direction,
          duration: c.analytics?.durationSec || c.duration,
          totalTurns: c.analytics?.totalTurns,
          avgLatency: c.analytics?.avgResponseLatencyMs,
          actionsTriggered: c.analytics?.actionsTriggered || Object.keys(c.actionsFired || {}),
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          endedAt: c.endedAt
        })),
      recentLeads: leads
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        .slice(0, 25)
        .map(l => ({
          phone: l.phone,
          clientName: l.clientName,
          industry: l.industry,
          stage: l.stage,
          smsSent: l.smsSent,
          paymentSmsSent: l.paymentSmsSent,
          dealClosed: l.dealClosed,
          doNotCall: l.doNotCall,
          packageId: l.packageId,
          updatedAt: l.updatedAt,
          createdAt: l.createdAt
        })),
      receptionistsList: receptionists.map(r => ({
        configKey: r.configKey,
        clientName: r.clientName,
        industry: r.industry,
        twilioPhoneNumber: r.twilioPhoneNumber,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      })),
      updatedAt: this.state.updatedAt
    };
  }

  /**
   * Force-write pending debounced state to disk (call on process shutdown).
   */
  flush() {
    flushSync(this.state);
  }

  /**
   * Merge actionsFired flags onto a call without clobbering other fields.
   */
  markActionFired(callSid, code, at = new Date().toISOString()) {
    if (!callSid || !code) return null;
    const call = this.getCall(callSid) || { callSid };
    const actionsFired = { ...(call.actionsFired || {}), [code]: at };
    return this.setCall(callSid, { ...call, actionsFired });
  }
}

module.exports = new Store();
