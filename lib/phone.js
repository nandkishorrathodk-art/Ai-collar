/**
 * Phone number helpers — basic E.164 validation & normalization for US (+1).
 */

/**
 * Normalize to E.164 when possible.
 * Accepts: +12145550188, 2145550188, 12145550188, (214) 555-0188
 */
function normalizePhone(input) {
  if (!input || typeof input !== 'string') return null;

  const raw = input.trim();
  let candidate = null;

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15) candidate = `+${digits}`;
  } else {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) {
      const defaultCode = process.env.DEFAULT_COUNTRY_CODE || '+1';
      const prefix = defaultCode.startsWith('+') ? defaultCode : `+${defaultCode}`;
      candidate = `${prefix}${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      candidate = `+${digits}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      candidate = `+${digits}`;
    } else if (digits.length >= 10 && digits.length <= 15) {
      candidate = `+${digits}`;
    }
  }

  // Validate E.164 regex pattern (country code 1-9 followed by 9-14 digits)
  if (candidate && /^\+[1-9]\d{9,14}$/.test(candidate)) {
    return candidate;
  }
  return null;
}

/**
 * Validate E.164-ish phone number.
 */
function isValidPhone(input) {
  return Boolean(normalizePhone(input));
}

/**
 * Safe key for maps / filenames from a phone number.
 */
function phoneKey(input) {
  const n = normalizePhone(input);
  return n ? n.replace(/\D/g, '') : null;
}

module.exports = { normalizePhone, isValidPhone, phoneKey };
