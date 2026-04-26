// Reads routing-decisions.json produced by Claude, then:
//   - Updates each ticket in Firestore (status, routedTo, agentNotes)
//   - Creates GitHub Issues for bug tickets
// Called by the support-router GitHub Actions workflow.
// Requires env: FIREBASE_SA, PROJECT_ID, GH_TOKEN, REPO, DRY_RUN

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { request } from 'https';

const sa = JSON.parse(process.env.FIREBASE_SA);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: process.env.PROJECT_ID
});
const db = admin.firestore();

const dryRun = process.env.DRY_RUN === 'true';
const decisions = JSON.parse(readFileSync('routing-decisions.json', 'utf8'));

function ghPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request({
      hostname: 'api.github.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GH_TOKEN,
        'User-Agent': 'bsf-support-router',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

let updated = 0;
let issued = 0;
const urgent = [];

for (const d of decisions) {
  if (d.urgency === 'URGENT') urgent.push(d.ref + ': ' + d.agentNotes);

  if (dryRun) {
    console.log('[DRY]', d.ref, '→', d.routedTo, d.urgency === 'URGENT' ? '⚠️ URGENT' : '');
    continue;
  }

  await db.collection('support_tickets').doc(d.id).update({
    status: 'routed',
    routedTo: d.routedTo,
    agentNotes: d.agentNotes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  updated++;

  if (d.createIssue && d.issueTitle) {
    await ghPost('/repos/' + process.env.REPO + '/issues', {
      title: d.issueTitle,
      body: d.issueBody || '',
      labels: ['agent-bug-fix']
    });
    issued++;
  }

  console.log(d.ref, '→', d.routedTo, d.urgency === 'URGENT' ? '⚠️ URGENT' : '');
}

console.log(`\nDone: ${decisions.length} decisions, ${updated} Firestore updates, ${issued} issues created`);

if (urgent.length > 0) {
  console.log('\n⚠️  URGENT TICKETS NEED MANUAL ATTENTION:');
  urgent.forEach(u => console.log(' -', u));
}

await admin.app().delete();
