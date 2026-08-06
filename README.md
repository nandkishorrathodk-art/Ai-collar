# 🇺🇸 USA AI CALLER — v4.1 Funnel Edition

> AI voice sales + inbound receptionist + **close funnel**  
> **Twilio** ↔ **OpenAI Realtime** · demo SMS · payment SMS · onboarding form · owner alerts

---

## What it does

**Sarah** cold-calls (or you warm-DM then trigger a test call), reveals she is AI, texts a demo + WhatsApp close link, can send payment-ready SMS, then the client finishes a **60-second onboarding form** → their inbound AI receptionist goes live.

```
Warm DM → Test call → [SEND_DEMO_SMS] → WhatsApp close
       → [SEND_PAYMENT] → Pay link + /onboard/<token>
       → Form submit → /twiml-inbound live
```

---

## Funnel: possible vs not (honest)

| Feature | Possible now? | How it works |
|---------|---------------|--------------|
| Demo SMS + `wa.me` prefilled chat | ✅ Yes | Twilio SMS (or simulation) |
| Payment-ready SMS ($499+$297, checkout link) | ✅ Yes | `POST /api/send-payment-sms` |
| 60-sec onboarding form | ✅ Yes | `/onboard/<token>` → receptionist config |
| Owner “hot lead” alert | ✅ Yes | `OWNER_NOTIFY_PHONE` SMS and/or `OWNER_WEBHOOK_URL` (Zapier→WhatsApp) |
| Auto WhatsApp **to the lead** (no SMS) | ⚠️ Not built-in | Needs Meta WhatsApp Business API |
| Live duplex phone AI | ✅ Only with **OpenAI Realtime** | Groq/ElevenLabs alone ≠ Twilio voice yet |
| Full funnel test without Twilio | ✅ Yes | `POST /api/funnel/simulate` |

---

## Quick funnel test (no Twilio needed)

```bash
npm run dev
curl -X POST http://localhost:5050/api/funnel/simulate -H "Content-Type: application/json" -d "{\"clientName\":\"Dallas Pro Plumbing\",\"industry\":\"plumbing\"}"
# Open the onboardingUrl from the response in a browser and submit
```

---

## v4 upgrades (what changed)

| Area | Before | After |
|------|--------|--------|
| Prompt engine | Broken duplicate tail in cold pitch; gym-only website line | Fixed, industry-aware, configurable pricing/agent |
| Call state | In-memory `Map` only (lost on restart) | JSON persistence in `data/store.json` + hot cache |
| Actions | Only partial `[SEND_DEMO_SMS]` on text delta | Full action bus: SMS, invoice, deal, DNC, booking, emergency |
| Transcript | Missed codes in audio modality | Listens to `response.audio_transcript.*` + text |
| Inbound | Setup API only, no TwiML | `/twiml-inbound` + receptionist by Twilio number |
| Security | Open control APIs | Optional `API_KEY` (`x-api-key` / Bearer) |
| Providers | Claimed Groq/ElevenLabs realtime that didn’t work | Honest OpenAI Realtime primary path |
| Ops | No health/history | `/health`, `/api/stats`, calls, leads, events |
| Phone | No validation | E.164 normalize + do-not-call list |

---

## Project structure

```
usa-ai-caller/
├── config/prompts.js      # Cold / follow-up / inbound prompt engine
├── lib/
│   ├── store.js           # Persistent calls, leads, receptionists, events
│   ├── actions.js         # Emit-code handlers (SMS, deal, booking…)
│   ├── phone.js           # E.164 validation
│   └── realtime.js        # Twilio ↔ OpenAI Realtime bridge
├── data/                  # Auto-created store (gitignored)
├── server.js
├── package.json
├── .env.example
└── README.md
```

---

## Quick start

```bash
cd usa-ai-caller
npm install
cp .env.example .env
# Fill: TWILIO_*, OPENAI_API_KEY, PUBLIC_HOSTNAME, optional API_KEY

npm run dev
# Expose webhooks:
npx ngrok http 5050
# Set PUBLIC_HOSTNAME to the ngrok host (no https://)
```

### Twilio number setup

| Direction | Voice webhook |
|-----------|----------------|
| Outbound answer URL | `https://YOUR_HOST/twiml-outbound` (set automatically by API) |
| Inbound receptionist | `https://YOUR_HOST/twiml-inbound` |
| Status callback | `https://YOUR_HOST/call-status` |

---

## API reference

All `POST /api/*` control routes accept optional auth when `API_KEY` is set:

```http
x-api-key: your-key
# or
Authorization: Bearer your-key
```

### `GET /health`
Liveness + Twilio/Realtime status + stats.

### `POST /api/call-usa-client` — cold outbound
```json
{
  "targetPhoneNumber": "+12145550188",
  "clientName": "Dallas Pro Plumbing",
  "industry": "plumbing",
  "weakness": "no 24/7 emergency booking form",
  "demoUrl": "https://your-demo.example"
}
```

### `POST /api/follow-up-call` — warm close
```json
{
  "targetPhoneNumber": "+12145550188",
  "clientName": "Dallas Pro Plumbing",
  "industry": "plumbing",
  "demoUrl": "https://your-demo.example"
}
```

### `POST /api/send-demo-sms`
Manual demo SMS (same template as on-call auto-send).

### `POST /api/setup-inbound-receptionist`
```json
{
  "clientName": "Bright Smile Dental",
  "industry": "dental",
  "ownerName": "Dr. Sarah Miller",
  "services": ["Cleaning", "Whitening", "Invisalign"],
  "businessHours": "8 AM to 6 PM, Monday through Saturday",
  "bookingUrl": "https://brightsmile.com/book",
  "twilioPhoneNumber": "+18005551234",
  "ownerPhone": "+18005559999",
  "emergencyProtocol": "text the owner immediately"
}
```
Point that Twilio number’s voice URL to `/twiml-inbound`.

### `GET /api/industries` · `GET /api/calls` · `GET /api/leads` · `GET /api/events` · `GET /api/stats`
### `POST /api/do-not-call` — `{ "phone": "+1..." }`
### `GET /api/prompt-preview?mode=cold&industry=plumbing&clientName=Test`

---

## AI emit codes (system actions)

The model appends these at the end of a turn; the server strips them from “spoken” intent and runs side effects:

| Code | Effect |
|------|--------|
| `[SEND_DEMO_SMS]` | Demo link SMS |
| `[SEND_INVOICE]` | Invoice / onboarding SMS |
| `[DEAL_CLOSED]` | Flag lead + event |
| `[DO_NOT_CALL]` | DNC list |
| `[BOOK_APPOINTMENT]` | Event + flag |
| `[CAPTURE_LEAD]` | Event + flag |
| `[EMERGENCY_DISPATCH]` | Event + optional owner SMS |
| `[SEND_FOLLOWUP_TEXT]` | Confirmation / follow-up SMS |

---

## Prompt modes

| Mode | Function | Use |
|------|----------|-----|
| Cold outbound | `getUniversalPitch()` | First touch |
| Follow-up | `getFollowUpPitch()` | After demo |
| Inbound | `getInboundPitch()` | Client’s customers |

Industries: roofing, plumbing, hvac, dental, medspa, restaurant, gym, lawyer, realestate, salon, auto (+ aliases).

---

## Revenue model (defaults in prompts)

| Service | Price |
|---------|-------|
| Custom website | $1,500 one-time |
| AI receptionist | $297/mo |
| Full package | both |

Override via env/prompt args as you productize.

---

## Architecture (voice path)

```
Your API  →  Twilio Call
               ↓
         TwiML <Stream>
               ↓
     /media-stream (WSS)
               ↓
     OpenAI Realtime (g711 μ-law)
               ↓
     transcript → action bus → SMS / CRM events
```

**Important:** Live duplex voice requires **OpenAI Realtime** (or a compatible proxy). Chat-only providers (e.g. Groq Llama) are not a drop-in for Twilio media streams without a separate STT→LLM→TTS pipeline.

---

## Roadmap (next advanced steps)

1. **SQLite / Postgres** instead of JSON file for multi-instance deploys  
2. **Calendar booking** (Cal.com / Google Calendar) on `[BOOK_APPOINTMENT]`  
3. **Dashboard UI** over `/api/stats` + leads  
4. **STT→LLM→ElevenLabs TTS** path for lower OpenAI cost  
5. **Compliance**: TCPA consent logs, recorded-call disclosure, state DNC  
6. **Queue + concurrency limits** for bulk dialing  
7. **Post-call summary** via GPT on full transcript  

---

*ZeroRefer Studio · USA AI Caller v4.0*
