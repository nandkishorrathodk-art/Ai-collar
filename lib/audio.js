/**
 * G.711 μ-law helpers for Twilio Media Streams ↔ Whisper/WAV.
 * Pure JS — no native deps.
 */

// μ-law decode (ITU-T G.711) → signed 16-bit PCM sample
function mulawByteToPcm16(mu) {
  mu = ~mu & 0xff;
  const sign = mu & 0x80;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return sign ? -sample : sample;
}

function pcm16ToMulawByte(sample) {
  const MULAW_MAX = 0x1fff;
  const BIAS = 0x84;
  const sign = sample < 0 ? 0x80 : 0;
  if (sample < 0) sample = -sample;
  if (sample > MULAW_MAX) sample = MULAW_MAX;
  sample = sample + BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {
    /* find exponent */
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const mulaw = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return mulaw;
}

/** Decode base64 μ-law payload from Twilio → Int16Array PCM @ 8kHz */
function decodeTwilioMulawBase64(b64) {
  const buf = Buffer.from(b64, 'base64');
  const pcm = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    pcm[i] = mulawByteToPcm16(buf[i]);
  }
  return pcm;
}

/** Encode Int16 PCM → raw μ-law Buffer */
function encodePcm16ToMulaw(pcm) {
  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    out[i] = pcm16ToMulawByte(pcm[i]);
  }
  return out;
}

/** Build mono 16-bit WAV buffer from PCM samples */
function pcm16ToWavBuffer(pcm, sampleRate = 8000) {
  const dataSize = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // pcm chunk size
  buffer.writeUInt16LE(1, 20); // audio format PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < pcm.length; i++) {
    buffer.writeInt16LE(pcm[i], 44 + i * 2);
  }
  return buffer;
}

/** Concatenate Int16Arrays */
function concatPcm(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Int16Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Simple RMS energy 0..1-ish for VAD */
function rmsEnergy(pcm) {
  if (!pcm.length) return 0;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / pcm.length);
}

/**
 * Split raw μ-law Buffer into base64 chunks for Twilio media events.
 * ~20ms frames = 160 bytes at 8kHz.
 */
function mulawToTwilioPayloads(mulawBuf, frameSize = 160) {
  const payloads = [];
  for (let i = 0; i < mulawBuf.length; i += frameSize) {
    const slice = mulawBuf.subarray(i, Math.min(i + frameSize, mulawBuf.length));
    payloads.push(slice.toString('base64'));
  }
  return payloads;
}

module.exports = {
  mulawByteToPcm16,
  pcm16ToMulawByte,
  decodeTwilioMulawBase64,
  encodePcm16ToMulaw,
  pcm16ToWavBuffer,
  concatPcm,
  rmsEnergy,
  mulawToTwilioPayloads
};
