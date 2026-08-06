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
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    const defaultCode = process.env.DEFAULT_COUNTRY_CODE || '+1';
    // Ensure the default code has a '+'
    const prefix = defaultCode.startsWith('+') ? defaultCode : `+${defaultCode}`;
    return `${prefix}${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
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
