/**
 * Shared promo campaign metadata for the
 * "30% off on 6-month subscription plans · Auto-applied at checkout"
 * banner + plan card UI.
 *
 * Source of truth for *price* is the backend discount document
 * (`promo-30-off-six-month-may2026`, code = MAY30) — these constants are
 * only used for the marketing UI (banner copy, ribbon labels, strike-through
 * preview).
 */

// 31st May 2026, end of day IST — campaign extension
export const PROMO_END_DATE = new Date('2026-05-31T23:59:59+05:30');
export const PROMO_PERCENT = 30;
export const PROMO_BILLING_CYCLE = '6-month';
// Admin/ads reference code for the campaign. The discount is auto-applied at
// checkout (no manual entry needed), but having a memorable code helps for
// social posts / WhatsApp blasts where teams say "use MAY30".
export const PROMO_CODE = 'MAY30';
// Bumping this string forces the banner to re-show even for users who had
// dismissed a previous campaign (different copy, different timing).
export const PROMO_VERSION = 'six-month-30-may2026-v3';

export const PROMO_DISMISS_KEY = `gn_promo_dismissed_${PROMO_VERSION}`;

export const isPromoActive = () => {
  return new Date() <= PROMO_END_DATE;
};

// Combined savings vs monthly billing when 6-month commitment + campaign
// promo are stacked. 6-month per-month is already ~20% off monthly; campaign
// adds another 30% off the 6-month rate ⇒ 1 - (0.8 * 0.7) = 0.44.
export const PROMO_SIX_MONTH_TOTAL_SAVING_PCT = 44;

export const formatPromoEndDate = () => {
  // e.g. "31 May 2026"
  return PROMO_END_DATE.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
};
