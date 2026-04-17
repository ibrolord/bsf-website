/**
 * BSF Store - localStorage wrapper with Firestore sync
 * Big Sister Foundation
 *
 * Manages sponsor profiles, donation transactions, and session state
 * in localStorage with optional Firestore cloud synchronization.
 *
 * Usage:
 *   BSFStore.saveSponsor({ name: 'Jane', email: 'jane@example.com' });
 *   BSFStore.addTransaction({ amount: 5000, currency: 'NGN', type: 'donation', status: 'success' });
 *   BSFStore.syncDonationToFirestore(db, txn);
 */

window.BSFStore = (function () {
  'use strict';

  // ── Storage keys ──────────────────────────────────────────────────
  var KEYS = {
    SPONSOR:      'bsf_sponsor_profile',
    TRANSACTIONS: 'bsf_transactions',
    SESSION:      'bsf_session'
  };

  // ── Safe JSON helpers ─────────────────────────────────────────────
  function _getJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('[BSFStore] Failed to parse ' + key, e);
      return fallback;
    }
  }

  function _setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('[BSFStore] Failed to save ' + key, e);
    }
  }

  // ── Public API ────────────────────────────────────────────────────
  return {

    /* ── Sponsor profile CRUD ─────────────────────────────────────── */

    /** Retrieve the stored sponsor profile, or null if none exists. */
    getSponsor: function () {
      return _getJSON(KEYS.SPONSOR, null);
    },

    /** Persist a complete sponsor profile object. */
    saveSponsor: function (profile) {
      _setJSON(KEYS.SPONSOR, profile);
    },

    /** Merge partial updates into the existing sponsor profile. */
    updateSponsor: function (updates) {
      var sponsor = this.getSponsor();
      if (sponsor) {
        Object.assign(sponsor, updates);
        this.saveSponsor(sponsor);
      }
      return sponsor;
    },

    /** Remove the sponsor profile from local storage. */
    clearSponsor: function () {
      localStorage.removeItem(KEYS.SPONSOR);
    },

    /* ── Transaction management ────────────────────────────────────── */

    /** Return all stored transactions (newest first). */
    getTransactions: function () {
      return _getJSON(KEYS.TRANSACTIONS, []);
    },

    /** Prepend a new transaction and return it. */
    addTransaction: function (txn) {
      var txns = this.getTransactions();
      // Ensure every transaction has an id and timestamp
      txn.id        = txn.id        || this.generateId('txn_');
      txn.createdAt = txn.createdAt || new Date().toISOString();
      txns.unshift(txn);
      _setJSON(KEYS.TRANSACTIONS, txns);
      return txn;
    },

    /** Filter transactions by type (e.g. 'donation', 'sponsorship'). */
    getTransactionsByType: function (type) {
      return this.getTransactions().filter(function (t) {
        return t.type === type;
      });
    },

    /** Sum all successful transaction amounts, optionally filtered by currency. */
    getTotalDonated: function (currency) {
      return this.getTransactions()
        .filter(function (t) {
          return t.status === 'success' && (!currency || t.currency === currency);
        })
        .reduce(function (sum, t) { return sum + (Number(t.amount) || 0); }, 0);
    },

    /** Remove all stored transactions. */
    clearTransactions: function () {
      localStorage.removeItem(KEYS.TRANSACTIONS);
    },

    /* ── Session helpers ───────────────────────────────────────────── */

    /** Return the current session object. */
    getSession: function () {
      return _getJSON(KEYS.SESSION, {});
    },

    /** Persist a session object (e.g. auth tokens, last page visited). */
    saveSession: function (session) {
      _setJSON(KEYS.SESSION, session);
    },

    /** Quick check: has a sponsor profile been stored? */
    isRegisteredSponsor: function () {
      return !!this.getSponsor();
    },

    /** Clear all BSF data from localStorage. */
    clearAll: function () {
      this.clearSponsor();
      this.clearTransactions();
      localStorage.removeItem(KEYS.SESSION);
    },

    /* ── Firestore sync ────────────────────────────────────────────── */

    /**
     * Push a data object to a Firestore collection.
     * Returns a Promise that resolves with the document reference, or
     * resolves with null when no database instance is available.
     */
    syncToFirestore: function (db, collection, data) {
      if (!db) return Promise.resolve(null);
      try {
        return db.collection(collection).add(
          Object.assign({}, data, {
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          })
        );
      } catch (e) {
        console.error('[BSFStore] Firestore sync failed for ' + collection, e);
        return Promise.reject(e);
      }
    },

    /** Convenience: sync a donation transaction to the 'donations' collection. */
    syncDonationToFirestore: function (db, txn) {
      return this.syncToFirestore(db, 'donations', txn);
    },

    /** Convenience: sync a sponsor profile to the canonical email-keyed doc. */
    syncSponsorToFirestore: function (db, sponsor) {
      if (!db) return Promise.resolve(null);
      try {
        if (sponsor && sponsor.email) {
          var email = String(sponsor.email).trim().toLowerCase();
          return db.collection('sponsors').doc(email).set(
            Object.assign({}, sponsor, {
              email: email,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }),
            { merge: true }
          );
        }
        return this.syncToFirestore(db, 'sponsors', sponsor);
      } catch (e) {
        console.error('[BSFStore] Firestore sponsor sync failed', e);
        return Promise.reject(e);
      }
    },

    /* ── ID / reference generators ─────────────────────────────────── */

    /** Generate a semi-unique ID with an optional prefix. */
    generateId: function (prefix) {
      return (prefix || '') +
        Date.now().toString(36) +
        Math.random().toString(36).substr(2, 5);
    },

    /**
     * Generate a human-readable reference number.
     * Format: BSF-YYYYMMDD-XXXXXX  (e.g. BSF-20260403-A7K2MN)
     */
    generateRef: function () {
      var d    = new Date();
      var yyyy = d.getFullYear().toString();
      var mm   = ('0' + (d.getMonth() + 1)).slice(-2);
      var dd   = ('0' + d.getDate()).slice(-2);
      var rand = Math.random().toString(36).substr(2, 6).toUpperCase();
      return 'BSF-' + yyyy + mm + dd + '-' + rand;
    }
  };
})();
