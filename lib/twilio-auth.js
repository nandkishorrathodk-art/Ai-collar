/**
 * Twilio webhook signature validation helpers.
 * Soft-fails in local/dev unless REQUIRE_TWILIO_SIGNATURE=true.
 */
const twilio = require('twilio');

function buildWebhookUrl(publicHostname, requestPath) {
  const host = String(publicHostname || 'localhost:5050').replace(/^https?:\/\//, '');
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const pathOnly = String(requestPath || '/').split('?')[0];
  // Twilio always hits the public HTTPS URL (ngrok), never localhost.
  const protocol = isLocal ? 'http' : 'https';
  return `${protocol}://${host}${pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`}`;
}

/**
 * Fastify preHandler factory.
 * @param {{ publicHostname: string, log?: any }} opts
 */
function createTwilioSignatureGuard({ publicHostname, log = console } = {}) {
  return function requireTwilioSignature(request, reply, done) {
    if (process.env.VALIDATE_TWILIO_SIGNATURE === 'false') return done();

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return done();

    const signature = request.headers['x-twilio-signature'];
    const strict =
      process.env.REQUIRE_TWILIO_SIGNATURE === 'true' ||
      process.env.NODE_ENV === 'production';

    if (!signature) {
      if (strict) {
        reply.status(403).send({ error: 'Missing X-Twilio-Signature' });
        return;
      }
      log.warn?.('[TWILIO AUTH] missing signature (allowed in non-strict mode)');
      return done();
    }

    // Prefer the URL Twilio actually hit (X-Forwarded-* / Host from ngrok).
    const proto =
      request.headers['x-forwarded-proto'] ||
      (String(publicHostname || '').includes('localhost') ? 'http' : 'https');
    const hostHdr =
      request.headers['x-forwarded-host'] ||
      request.headers.host ||
      publicHostname;
    const pathOnly = (request.raw?.url || request.url || '/').split('?')[0];
    const candidates = [
      `${proto}://${hostHdr}${pathOnly}`,
      buildWebhookUrl(publicHostname, pathOnly),
      // Twilio sometimes validates with/without trailing slash
      `${proto}://${hostHdr}${pathOnly}`.replace(/\/$/, ''),
      buildWebhookUrl(publicHostname, pathOnly).replace(/\/$/, '')
    ];

    const params = request.body && typeof request.body === 'object' ? request.body : {};
    let valid = false;
    for (const url of candidates) {
      try {
        if (twilio.validateRequest(authToken, signature, url, params)) {
          valid = true;
          break;
        }
      } catch {
        /* try next */
      }
    }

    if (!valid) {
      if (strict) {
        log.warn?.({ path: pathOnly }, '[TWILIO AUTH] invalid signature');
        reply.status(403).send({ error: 'Invalid Twilio signature' });
        return;
      }
      log.warn?.('[TWILIO AUTH] invalid signature (allowed in non-strict mode)');
    }
    done();
  };
}

module.exports = {
  createTwilioSignatureGuard,
  buildWebhookUrl
};
