/**
 * Twilio Media Streams voice router.
 *
 * Path A — OpenAI Realtime (best latency, duplex)
 * Path B — Hybrid: Groq Whisper + Groq Chat + ElevenLabs ulaw_8000
 *           (works with keys many bootstrappers already have)
 */
const WebSocket = require('ws');
const { getUniversalPitch, getFollowUpPitch, getInboundPitch } = require('../config/prompts');
const store = require('./store');
const { hybridConfig, attachHybridMediaHandler } = require('./hybrid-voice');

function resolveOpenAiRealtime() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const customKey = process.env.CUSTOM_LLM_API_KEY;
  const customBase = process.env.CUSTOM_LLM_BASE_URL;
  const preferred = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  const realtimeModel =
    process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview-2024-10-01';
  const voice = process.env.OPENAI_VOICE || 'shimmer';

  if ((preferred === 'custom' || customBase) && customKey && customBase) {
    const rawHost = customBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const wsProtocol = customBase.startsWith('http://') ? 'ws' : 'wss';
    const model = process.env.CUSTOM_LLM_MODEL || realtimeModel;
    return {
      path: 'openai-compatible',
      ready: true,
      provider: 'custom',
      model,
      voice,
      url: `${wsProtocol}://${rawHost}/realtime?model=${encodeURIComponent(model)}`,
      headers: {
        Authorization: `Bearer ${customKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    };
  }

  if (openaiKey) {
    return {
      path: 'openai-realtime',
      ready: true,
      provider: 'openai',
      model: realtimeModel,
      voice,
      url: `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(realtimeModel)}`,
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    };
  }

  return { path: 'openai-realtime', ready: false, provider: 'openai', blockers: ['OPENAI_API_KEY missing'] };
}

/**
 * Unified status for /health and boot logs.
 */
function resolveRealtimeConfig() {
  const forceHybrid = (process.env.VOICE_PATH || '').toLowerCase() === 'hybrid';
  const openai = resolveOpenAiRealtime();
  const hybrid = hybridConfig();

  if (!forceHybrid && openai.ready) {
    return {
      ready: true,
      path: openai.path,
      provider: openai.provider,
      model: openai.model,
      voice: openai.voice,
      url: openai.url,
      headers: openai.headers,
      blockers: []
    };
  }

  if (hybrid.ready) {
    return {
      ready: true,
      path: 'hybrid',
      provider: hybrid.provider,
      model: hybrid.model,
      voice: hybrid.voice,
      sttModel: hybrid.sttModel,
      ttsModel: hybrid.ttsModel,
      blockers: forceHybrid ? [] : ['Using hybrid path (OpenAI Realtime not configured)']
    };
  }

  return {
    ready: false,
    path: 'none',
    provider: 'none',
    model: null,
    voice: null,
    blockers: [
      ...(openai.blockers || ['OPENAI_API_KEY missing']),
      ...(hybrid.blockers || [])
    ]
  };
}

function buildSystemPrompt(lead = {}) {
  if (lead.callType === 'follow-up') return getFollowUpPitch(lead);
  if (lead.type === 'inbound-receptionist' || lead.callType === 'inbound') {
    return lead.systemPrompt || getInboundPitch(lead);
  }
  return getUniversalPitch(lead);
}

function attachOpenAiMediaHandler(connection, { log, processTranscript, systemPrompt, lead, callSid }) {
  let streamSid = null;
  let openAiWs = null;
  let transcriptBuffer = '';
  let responseTranscript = '';
  let actionsProcessedForResponse = false;
  const socket = connection.socket || connection;
  const cfg = resolveOpenAiRealtime();

  function safeCloseAi() {
    if (openAiWs && (openAiWs.readyState === WebSocket.OPEN || openAiWs.readyState === WebSocket.CONNECTING)) {
      try {
        openAiWs.close();
      } catch {
        /* ignore */
      }
    }
    openAiWs = null;
  }

  async function flushActions(reason) {
    const chunk = responseTranscript || transcriptBuffer;
    if (!chunk || !processTranscript) return;
    if (actionsProcessedForResponse && reason !== 'stop') return;
    actionsProcessedForResponse = true;
    try {
      await processTranscript(chunk, lead, { callSid, reason });
    } catch (err) {
      log.error?.({ err }, 'processTranscript failed');
    }
    if (transcriptBuffer.length > 4000) transcriptBuffer = transcriptBuffer.slice(-2000);
    responseTranscript = '';
  }

  async function onAiMessage(raw) {
    try {
      const response = JSON.parse(raw.toString());
      if (response.type === 'response.audio.delta' && response.delta && streamSid && socket.readyState === 1) {
        socket.send(
          JSON.stringify({ event: 'media', streamSid, media: { payload: response.delta } })
        );
      }
      if (response.type === 'response.created') {
        actionsProcessedForResponse = false;
        responseTranscript = '';
      }
      if (response.type === 'response.audio_transcript.delta' && response.delta) {
        responseTranscript += response.delta;
        transcriptBuffer += response.delta;
      }
      if (response.type === 'response.text.delta' && response.delta) {
        responseTranscript += response.delta;
        transcriptBuffer += response.delta;
      }
      if (
        response.type === 'response.audio_transcript.done' ||
        response.type === 'response.text.done'
      ) {
        await flushActions(response.type);
      } else if (response.type === 'response.done') {
        await flushActions('response.done');
      }
      if (response.type === 'error') log.error?.({ err: response.error }, 'Realtime API error');
    } catch (err) {
      log.error?.({ err }, 'Error handling Realtime message');
    }
  }

  openAiWs = new WebSocket(cfg.url, { headers: cfg.headers });
  openAiWs.on('open', () => {
    log.info?.(`Connected to ${cfg.provider} Realtime`);
    openAiWs.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: systemPrompt,
          voice: cfg.voice,
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          temperature: 0.7,
          max_response_output_tokens: 600
        }
      })
    );
    if (lead.callType !== 'inbound' && lead.type !== 'inbound-receptionist') {
      setTimeout(() => {
        if (openAiWs?.readyState === WebSocket.OPEN) {
          openAiWs.send(JSON.stringify({ type: 'response.create' }));
        }
      }, 400);
    }
  });
  openAiWs.on('message', onAiMessage);
  openAiWs.on('error', (err) => log.error?.({ err }, 'Realtime WebSocket error'));
  openAiWs.on('close', () => log.info?.('Realtime WebSocket closed'));

  socket.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.event === 'start') {
        streamSid = data.start.streamSid;
        log.info?.(`[openai-realtime] stream=${streamSid} call=${callSid}`);
      } else if (data.event === 'media' && openAiWs?.readyState === WebSocket.OPEN) {
        openAiWs.send(
          JSON.stringify({ type: 'input_audio_buffer.append', audio: data.media.payload })
        );
      } else if (data.event === 'stop') {
        await flushActions('stop');
        if (callSid) {
          store.setCall(callSid, {
            ...lead,
            status: 'completed',
            stage: lead.smsSent ? 'demo_sent' : lead.stage || 'call_completed',
            transcriptExcerpt: transcriptBuffer.slice(-1500)
          });
        }
        safeCloseAi();
      }
    } catch (err) {
      log.error?.({ err }, 'Twilio media error (openai path)');
    }
  });
  socket.on('close', safeCloseAi);
  socket.on('error', safeCloseAi);
}

/**
 * Main entry — pick best available voice engine.
 */
function attachMediaStreamHandler(connection, { log, processTranscript }) {
  const socket = connection.socket || connection;
  let booted = false;

  // Wait for Twilio "start" to resolve callSid/lead, then attach engine
  const onFirstMessages = async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.event !== 'start' || booted) return;
      booted = true;

      const streamSid = data.start.streamSid;
      let callSid =
        data.start.customParameters?.callSid ||
        data.start.callSid ||
        data.start.customParameters?.callsid;

      let lead = store.getCall(callSid) || {};

      if (!lead.systemPrompt && data.start.customParameters?.to) {
        const cfg = store.findReceptionist({ toNumber: data.start.customParameters.to });
        if (cfg) {
          lead = {
            ...cfg,
            callSid,
            type: 'inbound-receptionist',
            callType: 'inbound',
            fromNumber: data.start.customParameters?.from,
            targetPhoneNumber: data.start.customParameters?.from
          };
          if (callSid) store.setCall(callSid, lead);
        }
      }

      lead.callSid = callSid || lead.callSid;
      // Outbound: target is the lead being called (already on store).
      // Inbound: target for SMS/callback is the caller (from).
      // Never overwrite a known outbound target with Twilio "to" (our number).
      const isInbound =
        lead.callType === 'inbound' || lead.type === 'inbound-receptionist';
      const fromParam =
        data.start.customParameters?.from || data.start.customParameters?.From;
      const toParam =
        data.start.customParameters?.to || data.start.customParameters?.To;
      if (isInbound) {
        lead.targetPhoneNumber =
          lead.targetPhoneNumber ||
          lead.fromNumber ||
          fromParam ||
          null;
        lead.fromNumber = lead.fromNumber || fromParam || lead.targetPhoneNumber;
      } else {
        lead.targetPhoneNumber =
          lead.targetPhoneNumber ||
          data.start.customParameters?.targetPhoneNumber ||
          // Only use "to" when it looks like the lead (not our Twilio line) and store was empty
          (toParam && toParam !== process.env.TWILIO_PHONE_NUMBER ? toParam : null) ||
          null;
      }
      lead.streamSid = streamSid;
      lead.status = 'in-progress';
      lead.stage = lead.stage || 'in_call';
      lead.actionsFired = lead.actionsFired || {};
      if (callSid) store.setCall(callSid, lead);

      const systemPrompt = buildSystemPrompt(lead);
      const mode =
        lead.callType === 'follow-up'
          ? 'FOLLOW-UP'
          : lead.type === 'inbound-receptionist'
            ? 'INBOUND'
            : 'COLD-OUTBOUND';

      const engine = resolveRealtimeConfig();
      log.info?.(
        `[${mode}] stream=${streamSid} call=${callSid} lead=${lead.clientName || 'n/a'} engine=${engine.path} ready=${engine.ready}`
      );

      if (!engine.ready) {
        log.error?.({ blockers: engine.blockers }, 'No voice engine ready');
        return;
      }

      // Re-inject the start event by using a small wrapper:
      // Both handlers listen for messages; we already consumed start — pass synthetic start via queue.
      // Simplest: remove this one-shot listener and let path-specific handler own the socket.
      socket.removeListener('message', onFirstMessages);

      if (engine.path === 'hybrid') {
        // Hybrid handler needs the start event — synthesize by calling with replay
        // Attach handler then re-emit start-shaped handling internally:
        attachHybridMediaHandler(connection, {
          log,
          systemPrompt,
          processTranscript,
          lead
        });
        // Manually trigger start logic: hybrid listens for start on next messages only.
        // So push a synthetic start through the same path:
        socket.emit('message', Buffer.from(JSON.stringify(data)));
      } else {
        attachOpenAiMediaHandler(connection, {
          log,
          processTranscript,
          systemPrompt,
          lead,
          callSid
        });
        // OpenAI handler also waits for start — re-emit
        socket.emit('message', Buffer.from(JSON.stringify(data)));
      }
    } catch (err) {
      log.error?.({ err }, 'Failed to boot media stream engine');
    }
  };

  socket.on('message', onFirstMessages);
}

module.exports = {
  attachMediaStreamHandler,
  resolveRealtimeConfig,
  buildSystemPrompt,
  resolveOpenAiRealtime,
  hybridConfig
};
