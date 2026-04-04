/**
 * BSF Paystack - Payment integration wrapper
 * Big Sister Foundation
 *
 * Multi-currency Paystack payment handler with sponsorship tier logic.
 * Requires the Paystack inline script to be loaded on the page:
 *   <script src="https://js.paystack.co/v2/inline.js"></script>
 *
 * Usage:
 *   BSFPaystack.pay({
 *     email: 'donor@example.com',
 *     amount: 10000,
 *     currency: 'NGN',
 *     metadata: { program: 'Education' },
 *     onSuccess: function(response) { ... },
 *     onClose: function() { ... }
 *   });
 */

window.BSFPaystack = (function () {
  'use strict';

  return {

    // ── Configuration ─────────────────────────────────────────────
    // IMPORTANT: Replace with your live Paystack public key for production
    publicKey: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',

    // ── Supported currencies with display metadata and preset amounts ──
    currencies: {
      NGN: { symbol: '\u20A6', name: 'Nigerian Naira',   flag: '\uD83C\uDDF3\uD83C\uDDEC', presets: [2000, 5000, 10000, 25000, 50000] },
      USD: { symbol: '$',      name: 'US Dollar',        flag: '\uD83C\uDDFA\uD83C\uDDF8', presets: [10, 25, 50, 100, 250] },
      GBP: { symbol: '\u00A3', name: 'British Pound',    flag: '\uD83C\uDDEC\uD83C\uDDE7', presets: [10, 25, 50, 100, 200] },
      EUR: { symbol: '\u20AC', name: 'Euro',             flag: '\uD83C\uDDEA\uD83C\uDDFA', presets: [10, 25, 50, 100, 200] },
      CAD: { symbol: 'C$',     name: 'Canadian Dollar',  flag: '\uD83C\uDDE8\uD83C\uDDE6', presets: [15, 25, 50, 100, 250] }
    },

    // ── Currency helpers ──────────────────────────────────────────

    /** Convert a major-unit amount to the smallest unit (kobo, cents, etc.). */
    toSmallestUnit: function (amount, currency) {
      return Math.round(Number(amount) * 100);
    },

    /** Convert a smallest-unit amount back to a display string with decimals. */
    toDisplayAmount: function (amountSmall, currency) {
      return (amountSmall / 100).toFixed(2);
    },

    /**
     * Format a smallest-unit amount with the currency symbol.
     * e.g. formatAmount(500000, 'NGN') => "\u20A65,000.00"
     */
    formatAmount: function (amountSmall, currency) {
      var c = this.currencies[currency] || this.currencies.NGN;
      var display = (amountSmall / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      return c.symbol + display;
    },

    /**
     * Format a major-unit amount with the currency symbol and locale grouping.
     * e.g. formatDisplayAmount(5000, 'NGN') => "\u20A65,000"
     */
    formatDisplayAmount: function (amount, currency) {
      var c = this.currencies[currency] || this.currencies.NGN;
      return c.symbol + Number(amount).toLocaleString();
    },

    /** Look up a currency's metadata (symbol, name, flag, presets). */
    getCurrencyInfo: function (currency) {
      return this.currencies[currency] || this.currencies.NGN;
    },

    // ── Payment ───────────────────────────────────────────────────

    /**
     * Initiate a Paystack payment.
     *
     * @param {Object} options
     * @param {string} options.email      - Payer email (required by Paystack)
     * @param {number} options.amount     - Amount in major currency units
     * @param {string} [options.currency] - ISO currency code (default: NGN)
     * @param {string} [options.ref]      - Custom reference; auto-generated if omitted
     * @param {Object} [options.metadata] - Arbitrary metadata sent to Paystack
     * @param {Function} [options.onSuccess] - Called with Paystack response on success
     * @param {Function} [options.onClose]   - Called when the payment dialog is closed
     */
    pay: function (options) {
      if (typeof PaystackPop === 'undefined') {
        console.error('[BSFPaystack] PaystackPop is not loaded. Include the Paystack inline script.');
        return;
      }

      var self = this;
      var currency = options.currency || 'NGN';
      var ref = options.ref || (window.BSFStore ? BSFStore.generateRef() : 'BSF-' + Date.now());

      var handler = PaystackPop.setup({
        key:      self.publicKey,
        email:    options.email,
        amount:   self.toSmallestUnit(options.amount, currency),
        currency: currency,
        ref:      ref,
        metadata: options.metadata || {},
        callback: function (response) {
          if (typeof options.onSuccess === 'function') {
            options.onSuccess(response);
          }
        },
        onClose: function () {
          if (typeof options.onClose === 'function') {
            options.onClose();
          }
        }
      });

      handler.openIframe();
    },

    // ── Sponsor tier calculation ──────────────────────────────────

    /**
     * Determine the sponsorship tier based on the donation amount.
     * Amounts are normalised to NGN equivalents for tier boundaries.
     *
     * Tiers (monthly NGN equivalent):
     *   >= 50,000  Baobab   (highest)
     *   >= 25,000  Elder
     *   >= 10,000  Grower
     *   <  10,000  Seedling (entry)
     */
    getTier: function (amount, currency) {
      // Approximate NGN conversion rates (for tier calculation only)
      var rates = { NGN: 1, USD: 1500, GBP: 1900, EUR: 1700, CAD: 1100 };
      var ngnAmount = Number(amount) * (rates[currency] || 1);

      if (ngnAmount >= 50000) return { name: 'Baobab',   color: '#C2734C', icon: '\uD83C\uDF33' };
      if (ngnAmount >= 25000) return { name: 'Elder',    color: '#D4A96A', icon: '\uD83C\uDF32' };
      if (ngnAmount >= 10000) return { name: 'Grower',   color: '#2D5E40', icon: '\uD83C\uDF31' };
      return                          { name: 'Seedling', color: '#8BAF8E', icon: '\uD83C\uDF30' };
    }
  };
})();
