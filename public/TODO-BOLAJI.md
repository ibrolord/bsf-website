# BSF Website — Bolaji's Personal TODO

Things Claude can't do for you. Each item has clear steps and where to plug the result back in.

---

## 1. Paystack Account Verification
**Status:** Test keys working, need live keys
**Why:** Live payments won't process until verified
**Steps:**
1. Log into dashboard.paystack.com
2. Go to Settings → Business Settings
3. Upload ID (NIN, passport, or driver's license)
4. Add your bank account for settlements
5. Wait 24-48 hours for approval
6. Once approved, go to Settings → API Keys & Webhooks
7. Copy the **live** public key (`pk_live_...`) and secret key (`sk_live_...`)

**Where to update:** Tell Claude to swap keys in `/donate/index.html` line ~554 (PAYSTACK_PUBLIC_KEY)

---

## 2. Trust Wallet — Crypto Addresses
**Status:** Not created yet
**Why:** Donate page shows "Coming Soon" for crypto
**Steps:**
1. Download Trust Wallet on your phone (App Store / Play Store)
2. Create new wallet → write the 12-word seed phrase on PAPER (never digital)
3. Tap Receive → search "USDT" → select "Tron (TRC20)" → copy address
4. Tap Receive → search "USDC" → select "Base" → copy address
5. Paste both addresses to Claude

**Where to update:** `/donate/index.html` lines ~634-639 — replace "TBD — Coming Soon"

---

## 3. PayPal Business Account
**Status:** Not created
**Why:** Diaspora donors need PayPal option
**Steps:**
1. Go to paypal.com/ng/business
2. Sign up with BSF email
3. Link a domiciliary (USD) bank account for withdrawals
4. Create a PayPal.me link (paypal.me/YourChosenName)
5. Optional: Apply for nonprofit rates (1.99% vs 2.99%) at paypal.com/nonprofits

**Where to update:** `/donate/index.html` line ~615 — replace `paypal.me/bigsisterfoundation` with real link

---

## 4. Real Bank Account Details
**Status:** Placeholder on donate page
**Why:** Bank transfer section shows dummy GTBank / 0123456789
**Steps:**
1. Decide which bank account receives BSF donations
2. Get: Bank name, Account name, Account number

**Where to update:** `/donate/index.html` lines ~652-660

---

## 5. WhatsApp Business Number
**Status:** DONE — All placeholder `2348000000000` references replaced with email (princebolajibreeze@gmail.com)
**What was done:** WhatsApp links across all pages replaced with mailto links. Footer WhatsApp entries removed. CTA buttons updated to email equivalents.

---

## 6. Firebase Security Rules — Goals Collection
**Status:** Donate page falls back to local data because Firestore blocks reads
**Why:** `goals` collection has no read permission
**Steps:**
1. Go to Firebase Console → Firestore Database → Rules
2. Add this inside the `rules_version = '2'` block:
```
match /goals/{goalId} {
  allow read: if true;
  allow write: if request.auth != null;
}
```
3. Click Publish

---

## 7. Set Up Email Routing for thebigsisterfoundation.org
**Status:** DONE — Cloudflare Email Routing configured
**Routes:** `hello@thebigsisterfoundation.org` + `give@thebigsisterfoundation.org` → `bolajiagunbiade1@gmail.com`

---

## 8. Deploy to Vercel
**Status:** DONE — pushed to feat/bsf-website, Vercel auto-deploying
**Why:** Nobody can see the site yet
**Steps:**
1. Tell Claude to commit and push
2. Or run: `cd ~/TrashShit/claudecode/VNtranscript && git add -A && git push`
3. Vercel auto-deploys from the branch

---

## Priority Order
1. ~~**WhatsApp → Email**~~ DONE — all pages use hello@ and give@ now
2. **Email routing** (5 min — Cloudflare free, so emails actually arrive)
3. **Bank details** (5 seconds — just tell Claude)
4. **Firebase rules** (2 minutes in console)
5. **Trust Wallet** (2 minutes on phone)
6. **Paystack verification** (5 min setup + 24-48hr wait)
7. **PayPal business** (10 min + verification wait)
8. **Deploy** (tell Claude when ready)
