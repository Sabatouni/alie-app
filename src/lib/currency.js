// ALIÈ is a TZS-first storefront: every current product and every new order
// is TZS. A handful of orders placed before the TZS migration are historical
// USD records and must keep displaying as USD, so this formatter takes the
// currency explicitly rather than assuming one — never call it without
// passing the row's own `currency` value.
//
// Hand-rolled rather than Intl's `style: 'currency'` on purpose: browser
// currency formatting for TZS is inconsistent (some environments render
// "TSh133,000", others "133,000.00 TZS") and ALIÈ needs exactly one look
// everywhere — "TZS 133,000".

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const FRACTION_DIGITS = { TZS: 0, USD: 2 };

/** Plain grouped number, no currency label. formatAmount(133000) → "133,000" */
export function formatAmount(value, currency = 'TZS') {
  const n = toFiniteNumber(value);
  if (n === null) return '0';
  const digits = FRACTION_DIGITS[currency] ?? 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Full customer-facing label. formatMoney(133000) → "TZS 133,000"
 * formatMoney(13, 'USD') → "USD 13.00" (historical orders only — never used
 * for a current product or a new order).
 */
export function formatMoney(value, currency = 'TZS') {
  const cur = (currency || 'TZS').toUpperCase();
  return `${cur} ${formatAmount(value, cur)}`;
}
