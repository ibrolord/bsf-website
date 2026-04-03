# EmailJS Setup for Big Sister Foundation

## Step 1: Create Account (1 min)
1. Go to https://www.emailjs.com/
2. Click "Sign Up Free" (200 emails/month free)
3. Sign up with your Google account or email

## Step 2: Connect Your Email (1 min)
1. Go to "Email Services" in the sidebar
2. Click "Add New Service"
3. Select "Gmail" (or whichever email you want to send from)
4. Click "Connect Account" and authorize
5. Copy the **Service ID** (looks like: service_xxxxxxx)

## Step 3: Create Approval Template (2 min)
1. Go to "Email Templates" in the sidebar
2. Click "Create New Template"
3. Set the template name to: volunteer_approved
4. Set these fields:
   - **To Email**: {{to_email}}
   - **From Name**: Big Sister Foundation
   - **Subject**: Welcome to Big Sister Foundation — You're Approved!
5. Paste the HTML from `template_approve.html` into the template body (use "Code Editor" tab)
6. Click "Save"
7. Copy the **Template ID** (looks like: template_xxxxxxx)

## Step 4: Create Rejection Template (1 min)
1. Click "Create New Template" again
2. Set the template name to: volunteer_rejected
3. Set these fields:
   - **To Email**: {{to_email}}
   - **From Name**: Big Sister Foundation
   - **Subject**: Big Sister Foundation — Application Update
4. Paste the HTML from `template_reject.html` into the template body
5. Click "Save"
6. Copy the **Template ID**

## Step 5: Get Your Public Key (30 sec)
1. Go to "Account" in the sidebar
2. Under "Public Key", copy the key (looks like: xxxxxxxxxxxxxxxxx)

## Step 6: Paste Into Admin Panel
Open `/admin/index.html` and find these lines near the top of the <script>:

```
var EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
var EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
var EMAILJS_TEMPLATE_APPROVE = 'YOUR_APPROVE_TEMPLATE_ID';
var EMAILJS_TEMPLATE_REJECT = 'YOUR_REJECT_TEMPLATE_ID';
```

Replace with your actual values, then redeploy:
```
vercel --prod --yes
```

## Template Variables Reference
These variables are automatically sent from the admin panel:
- {{to_name}} — Volunteer's full name
- {{to_email}} — Volunteer's email address
- {{roles}} — Selected volunteer roles (e.g. "Mentorship, Teaching & Tutoring")
- {{message}} — Auto-generated approval/rejection message
- {{registration_link}} — Link to complete registration
