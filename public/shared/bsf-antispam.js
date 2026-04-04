/**
 * BSF Anti-Spam — Honeypot + Rate Limiting + Turnstile-ready
 * Load on any page with forms: <script src="/shared/bsf-antispam.js"></script>
 *
 * Usage:
 *   1. Call BSFAntiSpam.protect('formId') after DOM is ready
 *   2. Call BSFAntiSpam.validate('formId') before processing submission
 *   3. If validate() returns false, the submission is spam — block it
 *
 * Turnstile: Set BSFAntiSpam.turnstileSiteKey before calling protect()
 *            to auto-inject Cloudflare Turnstile widgets into forms.
 */
(function () {
  'use strict';

  var RATE_LIMIT_KEY = 'bsf_submit_times';
  var RATE_LIMIT_MAX = 5;         // max submissions per window
  var RATE_LIMIT_WINDOW = 60000;  // 1 minute in ms
  var MIN_FILL_TIME = 2000;       // minimum ms to fill a form (bots are instant)

  window.BSFAntiSpam = {

    // Set this to your Cloudflare Turnstile site key to enable Turnstile
    // Get one at: https://dash.cloudflare.com/turnstile
    turnstileSiteKey: null,

    // Track form load times for timing-based detection
    _formLoadTimes: {},

    /**
     * Protect a form: injects honeypot field, records load time,
     * optionally adds Turnstile widget.
     * Call once per form after DOM is ready.
     */
    protect: function (formId) {
      var form = document.getElementById(formId);
      if (!form) return;

      // Record when the form became visible (bots submit instantly)
      this._formLoadTimes[formId] = Date.now();

      // Inject honeypot field — hidden from humans, bots fill it
      var honeypot = document.createElement('div');
      honeypot.setAttribute('aria-hidden', 'true');
      honeypot.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:0;width:0;overflow:hidden;';

      var label1 = document.createElement('label');
      label1.setAttribute('for', 'bsf_website_' + formId);
      label1.textContent = 'Website';
      honeypot.appendChild(label1);

      var input1 = document.createElement('input');
      input1.type = 'text';
      input1.name = 'bsf_website';
      input1.id = 'bsf_website_' + formId;
      input1.tabIndex = -1;
      input1.autocomplete = 'off';
      input1.value = '';
      honeypot.appendChild(input1);

      form.appendChild(honeypot);

      // Inject secondary honeypot (email-style — bots love email fields)
      var honeypot2 = document.createElement('div');
      honeypot2.setAttribute('aria-hidden', 'true');
      honeypot2.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:0;width:0;overflow:hidden;';

      var label2 = document.createElement('label');
      label2.setAttribute('for', 'bsf_confirm_email_' + formId);
      label2.textContent = 'Confirm Email';
      honeypot2.appendChild(label2);

      var input2 = document.createElement('input');
      input2.type = 'email';
      input2.name = 'bsf_confirm_email';
      input2.id = 'bsf_confirm_email_' + formId;
      input2.tabIndex = -1;
      input2.autocomplete = 'off';
      input2.value = '';
      honeypot2.appendChild(input2);

      form.appendChild(honeypot2);

      // Inject Turnstile widget if site key is configured
      if (this.turnstileSiteKey) {
        this._injectTurnstile(form);
      }
    },

    /**
     * Validate a form submission. Returns { valid: true/false, reason: string }
     * Call this BEFORE processing the form data.
     */
    validate: function (formId) {
      var form = document.getElementById(formId);
      if (!form) return { valid: false, reason: 'Form not found' };

      // Check honeypot fields — if filled, it's a bot
      var hp1 = form.querySelector('[name="bsf_website"]');
      var hp2 = form.querySelector('[name="bsf_confirm_email"]');

      if (hp1 && hp1.value.length > 0) {
        this._logSpam(formId, 'honeypot_website');
        return { valid: false, reason: 'spam' };
      }

      if (hp2 && hp2.value.length > 0) {
        this._logSpam(formId, 'honeypot_email');
        return { valid: false, reason: 'spam' };
      }

      // Check timing — humans take at least 2 seconds to fill a form
      var loadTime = this._formLoadTimes[formId];
      if (loadTime && (Date.now() - loadTime) < MIN_FILL_TIME) {
        this._logSpam(formId, 'too_fast');
        return { valid: false, reason: 'spam' };
      }

      // Check rate limiting — prevent rapid-fire submissions
      if (this._isRateLimited()) {
        this._logSpam(formId, 'rate_limited');
        return { valid: false, reason: 'rate_limited' };
      }

      // Check Turnstile token if enabled
      if (this.turnstileSiteKey) {
        var token = form.querySelector('[name="cf-turnstile-response"]');
        if (!token || !token.value) {
          return { valid: false, reason: 'turnstile_missing' };
        }
      }

      // Record this submission for rate limiting
      this._recordSubmission();

      // Reset form load time for next submission
      this._formLoadTimes[formId] = Date.now();

      return { valid: true, reason: 'ok' };
    },

    /**
     * Quick helper: validate and show toast if spam.
     * Returns true if valid, false if blocked.
     */
    check: function (formId, toastFn) {
      var result = this.validate(formId);
      if (!result.valid) {
        var msg = result.reason === 'rate_limited'
          ? 'Too many submissions. Please wait a moment and try again.'
          : 'Submission blocked. Please try again.';
        if (typeof toastFn === 'function') {
          toastFn(msg, 'error');
        } else if (typeof showToast === 'function') {
          showToast(msg, 'error');
        }
        return false;
      }
      return true;
    },

    // ── Internal methods ──

    _isRateLimited: function () {
      var times = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');
      var now = Date.now();
      times = times.filter(function (t) { return (now - t) < RATE_LIMIT_WINDOW; });
      return times.length >= RATE_LIMIT_MAX;
    },

    _recordSubmission: function () {
      var times = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '[]');
      var now = Date.now();
      times = times.filter(function (t) { return (now - t) < RATE_LIMIT_WINDOW; });
      times.push(now);
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(times));
    },

    _logSpam: function (formId, type) {
      console.warn('[BSF Anti-Spam] Blocked submission on #' + formId + ' — reason: ' + type);
    },

    _injectTurnstile: function (form) {
      // Load Turnstile script if not already loaded
      if (!document.querySelector('script[src*="turnstile"]')) {
        var script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      // Add Turnstile widget before the submit button
      var submitBtn = form.querySelector('[type="submit"], .btn--terra, .btn--green');
      if (submitBtn) {
        var widget = document.createElement('div');
        widget.className = 'cf-turnstile';
        widget.style.marginBottom = '1rem';
        widget.setAttribute('data-sitekey', this.turnstileSiteKey);
        widget.setAttribute('data-theme', 'light');
        submitBtn.parentNode.insertBefore(widget, submitBtn);
      }
    }
  };
})();
