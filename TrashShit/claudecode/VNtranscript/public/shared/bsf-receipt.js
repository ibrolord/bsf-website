/**
 * BSF Receipt - Client-side donation receipt generator
 * Big Sister Foundation
 *
 * Generates a printable / Save-as-PDF donation receipt in a new browser
 * window. No external dependencies required -- uses the browser's native
 * print dialog for PDF export.
 *
 * Usage:
 *   BSFReceipt.generate({
 *     ref: 'BSF-20260403-A7K2MN',
 *     date: '2026-04-03T14:30:00Z',
 *     donorName: 'Jane Okafor',
 *     amount: 10000,
 *     currency: 'NGN',
 *     program: 'Education Sponsorship',
 *     paymentRef: 'PAY-abc123'
 *   });
 *
 *   BSFReceipt.download(txnObject);  // same as generate -- print dialog allows "Save as PDF"
 */

window.BSFReceipt = (function () {
  'use strict';

  // ── BSF tree logo as inline SVG ───────────────────────────────
  var LOGO_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100" width="60" height="75">',
    '  <circle cx="40" cy="30" r="26" fill="#2D5E40" opacity="0.9"/>',
    '  <circle cx="26" cy="22" r="16" fill="#3A7A52" opacity="0.8"/>',
    '  <circle cx="54" cy="22" r="16" fill="#3A7A52" opacity="0.8"/>',
    '  <circle cx="40" cy="16" r="14" fill="#4A8F62" opacity="0.7"/>',
    '  <rect x="36" y="52" width="8" height="30" rx="3" fill="#8B6F4E"/>',
    '  <ellipse cx="40" cy="86" rx="18" ry="5" fill="#2D5E40" opacity="0.15"/>',
    '</svg>'
  ].join('\n');

  // ── Brand colours ─────────────────────────────────────────────
  var COLORS = {
    green:     '#2D5E40',
    greenDark: '#1E4A2F',
    gold:      '#C2734C',
    goldLight: '#D4A96A',
    cream:     '#FAF7F2',
    textDark:  '#2C2C2C',
    textMuted: '#6B6B6B',
    border:    '#E8E0D4'
  };

  // ── Helpers ───────────────────────────────────────────────────

  /** Format an ISO date string (or Date) into a human-readable form. */
  function _formatDate(dateInput) {
    var d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    var months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  /** Format an amount with the correct currency symbol. */
  function _formatAmount(amount, currency) {
    if (window.BSFPaystack) {
      return BSFPaystack.formatDisplayAmount(amount, currency);
    }
    var symbols = { NGN: '\u20A6', USD: '$', GBP: '\u00A3', EUR: '\u20AC', CAD: 'C$' };
    return (symbols[currency] || '') + Number(amount).toLocaleString();
  }

  /** Safely set text content on an element to prevent XSS. */
  function _setText(el, text) {
    el.textContent = text;
  }

  // ── Receipt HTML builder ──────────────────────────────────────

  /**
   * Build a complete, self-contained HTML document string for the receipt.
   *
   * @param {Object} data
   * @param {string} data.ref         - Receipt / transaction reference
   * @param {string|Date} data.date   - Transaction date
   * @param {string} [data.donorName] - Donor's name (defaults to "Anonymous Donor")
   * @param {number} data.amount      - Donation amount in major currency units
   * @param {string} data.currency    - ISO currency code
   * @param {string} [data.program]   - Program the donation supports
   * @param {string} [data.paymentRef]- Payment gateway reference
   * @returns {string} Full HTML document
   */
  function _buildReceiptHTML(data) {
    var donor   = data.donorName || 'Anonymous Donor';
    var date    = _formatDate(data.date || new Date());
    var amount  = _formatAmount(data.amount, data.currency);
    var program = data.program || 'General Fund';
    var ref     = data.ref || 'N/A';
    var payRef  = data.paymentRef || ref;

    return [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>BSF Donation Receipt - ' + _escapeHTML(ref) + '</title>',
      '  <link rel="preconnect" href="https://fonts.googleapis.com">',
      '  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600;700&display=swap" rel="stylesheet">',
      '  <style>',
      '    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
      '',
      '    body {',
      '      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
      '      color: ' + COLORS.textDark + ';',
      '      background: ' + COLORS.cream + ';',
      '      display: flex;',
      '      justify-content: center;',
      '      padding: 40px 20px;',
      '    }',
      '',
      '    .receipt {',
      '      width: 100%;',
      '      max-width: 600px;',
      '      background: #FFFFFF;',
      '      border: 1px solid ' + COLORS.border + ';',
      '      border-radius: 8px;',
      '      overflow: hidden;',
      '    }',
      '',
      '    /* ── Header ─────────────────────────────────────── */',
      '    .receipt-header {',
      '      background: linear-gradient(135deg, ' + COLORS.green + ', ' + COLORS.greenDark + ');',
      '      color: #FFFFFF;',
      '      padding: 32px 40px;',
      '      text-align: center;',
      '    }',
      '    .receipt-header .logo { margin-bottom: 12px; }',
      '    .receipt-header h1 {',
      '      font-family: "EB Garamond", Georgia, serif;',
      '      font-size: 22px;',
      '      font-weight: 700;',
      '      letter-spacing: 0.05em;',
      '      margin-bottom: 4px;',
      '    }',
      '    .receipt-header .org-name {',
      '      font-family: "EB Garamond", Georgia, serif;',
      '      font-size: 15px;',
      '      opacity: 0.85;',
      '    }',
      '',
      '    /* ── Title band ─────────────────────────────────── */',
      '    .receipt-title {',
      '      background: ' + COLORS.gold + ';',
      '      color: #FFFFFF;',
      '      text-align: center;',
      '      padding: 10px 40px;',
      '      font-family: "EB Garamond", Georgia, serif;',
      '      font-size: 14px;',
      '      font-weight: 600;',
      '      letter-spacing: 0.15em;',
      '      text-transform: uppercase;',
      '    }',
      '',
      '    /* ── Body ───────────────────────────────────────── */',
      '    .receipt-body { padding: 32px 40px; }',
      '',
      '    .receipt-row {',
      '      display: flex;',
      '      justify-content: space-between;',
      '      padding: 12px 0;',
      '      border-bottom: 1px solid ' + COLORS.border + ';',
      '    }',
      '    .receipt-row:last-child { border-bottom: none; }',
      '    .receipt-label {',
      '      font-size: 13px;',
      '      color: ' + COLORS.textMuted + ';',
      '      text-transform: uppercase;',
      '      letter-spacing: 0.04em;',
      '    }',
      '    .receipt-value {',
      '      font-size: 15px;',
      '      font-weight: 600;',
      '      text-align: right;',
      '    }',
      '    .receipt-value.amount {',
      '      font-family: "EB Garamond", Georgia, serif;',
      '      font-size: 24px;',
      '      color: ' + COLORS.green + ';',
      '    }',
      '',
      '    /* ── Footer / thank-you ─────────────────────────── */',
      '    .receipt-thanks {',
      '      background: ' + COLORS.cream + ';',
      '      text-align: center;',
      '      padding: 28px 40px;',
      '      border-top: 1px solid ' + COLORS.border + ';',
      '    }',
      '    .receipt-thanks p {',
      '      font-family: "EB Garamond", Georgia, serif;',
      '      font-size: 16px;',
      '      color: ' + COLORS.green + ';',
      '      margin-bottom: 8px;',
      '      line-height: 1.5;',
      '    }',
      '    .receipt-thanks .org-details {',
      '      font-size: 12px;',
      '      color: ' + COLORS.textMuted + ';',
      '      margin-top: 12px;',
      '    }',
      '',
      '    /* ── Print styles ───────────────────────────────── */',
      '    @media print {',
      '      body {',
      '        background: #FFFFFF;',
      '        padding: 0;',
      '      }',
      '      .receipt {',
      '        border: none;',
      '        border-radius: 0;',
      '        max-width: 100%;',
      '        box-shadow: none;',
      '      }',
      '      .receipt-header {',
      '        -webkit-print-color-adjust: exact;',
      '        print-color-adjust: exact;',
      '      }',
      '      .receipt-title {',
      '        -webkit-print-color-adjust: exact;',
      '        print-color-adjust: exact;',
      '      }',
      '      .receipt-thanks {',
      '        -webkit-print-color-adjust: exact;',
      '        print-color-adjust: exact;',
      '      }',
      '      .no-print { display: none !important; }',
      '    }',
      '  </style>',
      '</head>',
      '<body>',
      '  <div class="receipt">',
      '',
      '    <!-- Header -->',
      '    <div class="receipt-header">',
      '      <div class="logo">' + LOGO_SVG + '</div>',
      '      <h1>Big Sister Foundation</h1>',
      '      <div class="org-name">Rooted. Present. Protective.</div>',
      '    </div>',
      '',
      '    <!-- Title band -->',
      '    <div class="receipt-title">Donation Receipt</div>',
      '',
      '    <!-- Body -->',
      '    <div class="receipt-body">',
      '      <div class="receipt-row">',
      '        <span class="receipt-label">Receipt Number</span>',
      '        <span class="receipt-value">' + _escapeHTML(ref) + '</span>',
      '      </div>',
      '      <div class="receipt-row">',
      '        <span class="receipt-label">Date</span>',
      '        <span class="receipt-value">' + _escapeHTML(date) + '</span>',
      '      </div>',
      '      <div class="receipt-row">',
      '        <span class="receipt-label">Donor</span>',
      '        <span class="receipt-value">' + _escapeHTML(donor) + '</span>',
      '      </div>',
      '      <div class="receipt-row">',
      '        <span class="receipt-label">Amount</span>',
      '        <span class="receipt-value amount">' + _escapeHTML(amount) + '</span>',
      '      </div>',
      '      <div class="receipt-row">',
      '        <span class="receipt-label">Program</span>',
      '        <span class="receipt-value">' + _escapeHTML(program) + '</span>',
      '      </div>',
      '      <div class="receipt-row">',
      '        <span class="receipt-label">Payment Reference</span>',
      '        <span class="receipt-value" style="font-size:13px;">' + _escapeHTML(payRef) + '</span>',
      '      </div>',
      '    </div>',
      '',
      '    <!-- Thank you -->',
      '    <div class="receipt-thanks">',
      '      <p>Thank you for your generous donation.<br>Your support helps change lives.</p>',
      '      <div class="org-details">',
      '        Big Sister Foundation<br>',
      '        Lagos, Nigeria<br>',
      '        www.bigsisterfoundation.org',
      '      </div>',
      '    </div>',
      '',
      '  </div>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  /** Escape HTML special characters to prevent injection. */
  function _escapeHTML(str) {
    var div = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (div) {
      div.textContent = str;
      return div.innerHTML;
    }
    // Fallback for non-browser environments
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Write HTML content into a window using safe DOM manipulation
   * instead of the deprecated document.write() method.
   */
  function _writeToWindow(win, html) {
    // Use DOMParser to safely parse the HTML and inject it
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');

    // Copy the parsed document into the new window
    // First, clear the new window's document
    var destDoc = win.document;
    destDoc.replaceChild(
      destDoc.importNode(doc.documentElement, true),
      destDoc.documentElement
    );
  }

  // ── Public API ────────────────────────────────────────────────

  return {

    /**
     * Open a new window with the formatted receipt and trigger the print dialog.
     * The user can print to paper or choose "Save as PDF" in the dialog.
     *
     * @param {Object} data - Transaction data (see _buildReceiptHTML for shape)
     */
    generate: function (data) {
      var html = _buildReceiptHTML(data);
      var win  = window.open('', '_blank', 'width=700,height=900');

      if (!win) {
        console.error('[BSFReceipt] Pop-up blocked. Please allow pop-ups for this site.');
        alert('Please allow pop-ups to view your receipt.');
        return;
      }

      // Safely inject HTML using DOM manipulation
      _writeToWindow(win, html);

      // Wait for fonts to load before triggering print
      setTimeout(function () { win.print(); }, 600);
    },

    /**
     * Download the receipt as a PDF via the browser's print dialog.
     * This is functionally the same as generate() -- the print dialog
     * provides a "Save as PDF" destination on all modern browsers.
     *
     * @param {Object} data - Transaction data
     */
    download: function (data) {
      this.generate(data);
    },

    /**
     * Return the receipt HTML string without opening a window.
     * Useful for embedding in an iframe or sending to a server.
     *
     * @param {Object} data - Transaction data
     * @returns {string} Complete HTML document
     */
    getHTML: function (data) {
      return _buildReceiptHTML(data);
    }
  };
})();
