// Fetches open support_tickets from Firestore and writes them to tickets.json.
// Called by the support-router GitHub Actions workflow.
// Requires env: FIREBASE_SA (service account JSON), PROJECT_ID

import admin from 'firebase-admin';
import { writeFileSync } from 'fs';

const sa = JSON.parse(process.env.FIREBASE_SA);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: process.env.PROJECT_ID
});

const db = admin.firestore();

const snap = await db.collection('support_tickets')
  .where('status', '==', 'open')
  .orderBy('createdAt', 'asc')
  .limit(20)
  .get();

const tickets = [];
snap.forEach(doc => {
  const data = doc.data();
  tickets.push({
    id: doc.id,
    ref: data.ref || doc.id.slice(0, 8),
    category: data.category || 'inquiry',
    subject: data.subject || '',
    message: data.message || '',
    name: data.name || '',
    email: data.email || '',
    status: data.status || 'open',
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
  });
});

writeFileSync('tickets.json', JSON.stringify(tickets, null, 2));
console.log(`Fetched ${tickets.length} open ticket(s)`);

await admin.app().delete();
