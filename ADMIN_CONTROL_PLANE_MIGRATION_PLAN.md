# Admin Control Plane Migration Plan

## Purpose

This file is the handoff plan for finishing the admin control-plane migration in unattended slices.

Already migrated to API:

- volunteer request decision
- volunteer invite
- ledger request resolve
- blog review
- sponsor status
- scholar save
- volunteer CRUD
- schools CRUD
- announcements CRUD
- events CRUD
- ledger CRUD
- selected goals, outreach, teams, and bulk actions

This plan covers the remaining direct admin-side write paths:

- communities CRUD and demo seeding
- ideas and forums moderation flows
- settings and user/team management flows
- blog editor create/update/delete

## Rules For Unattended Execution

Every slice must follow the same gates:

1. implement only the slice
2. commit only the intended files
3. deploy from `git archive HEAD`, never from the dirty worktree
4. run direct API verification
5. run Playwright UI verification
6. verify Firestore state changes
7. require:
   - `consoleErrors: []`
   - `pageErrors: []`
8. save reports under `/Users/ibrobaba/codex/ui-test-tmp/results`
9. only then move to the next slice

## Current Constraint

Fully unattended user account creation and password reset are not yet safe to migrate because the admin page still uses client-side Firebase Auth flows.

That part requires a proper server-side Firebase Auth admin credential in Vercel before it can be moved behind API.

So user/team work is split into:

- user document and settings flows now
- auth account creation and password reset later

## Slice 1 - Communities

### Current direct writes

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1713`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1726`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1727`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1173` bulk delete still bypasses API for `communities`

### API work

Add to `/Users/ibrobaba/codex/bsf-website/public/api/admin/mutate.js`:

- `community.save`
- `community.delete`
- `community.seed_demo`
- extend `bulk.delete` with `communities`

### Permissions

Use the existing keys already present in the admin UI:

- `communities.create`
- `communities.edit`
- `communities.delete`

Use `communities.create` for `community.seed_demo`.

### UI rewiring

Replace direct Firestore writes in:

- `saveCommunity()`
- `deleteCommunity()`
- `seedDemoCommunities()`
- `bulkDeleteSection('communities')`

### Verification

Direct API script:

- `401` no token
- `403` wrong role
- create
- update
- delete
- seed is idempotent
- bulk delete removes only requested IDs

UI script:

- create community
- edit community
- delete community
- seed demo communities
- bulk delete seeded test communities
- verify no stale rows remain

Planned artifacts:

- `/Users/ibrobaba/codex/ui-test-tmp/admin-communities-api-verify.mjs`
- `/Users/ibrobaba/codex/ui-test-tmp/admin-communities-ui-verify.js`

## Slice 2 - Ideas, Forums, Team Forums

### Current direct writes

Ideas:

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1915`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1916`

Forums:

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1923`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1924`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1925`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1928`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1929`

Team forums:

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2779`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2781`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2783`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2789`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2791`

Special case:

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2798` routes general forum create to `team_forums` client-side

### API work

Add to `/Users/ibrobaba/codex/bsf-website/public/api/admin/mutate.js`:

- `idea.save`
- `idea.delete`
- extend `bulk.delete` with `ideas`
- `forum.post.save`
- `forum.post.delete`
- `forum.post.pin`
- `forum.reply.save`
- `forum.reply.delete`
- `team_forum.post.save`
- `team_forum.post.delete`
- `team_forum.post.pin`
- `team_forum.reply.save`
- `team_forum.reply.delete`

### Permissions

Ideas:

- `ideas.edit_any`
- `ideas.delete_any`

Forums:

- `forums.create`
- `forums.edit_any`
- `forums.delete_any`
- `forums.moderate`

Team forums:

- `team_forums.create`
- `team_forums.edit`
- `team_forums.delete`
- `team_forums.moderate`

### UI rewiring

Replace direct Firestore writes in:

- `saveIdea()`
- `deleteIdea()`
- `saveForumPost()`
- `deleteForumPost()`
- `togglePinPost()`
- `saveForumReply()`
- `deleteReply()`
- `saveTeamForumPost()`
- `deleteTeamForumPost()`
- `toggleTeamForumPin()`
- `saveTeamForumReply()`
- `deleteTeamReply()`

Remove the client-side `_origSaveForumPost` override pattern. The server should own `teamId` routing.

### Verification

Direct API script:

- create/edit/delete idea
- create/edit/delete/pin forum post
- create/delete forum reply
- create/edit/delete/pin team forum post
- create/delete team forum reply
- wrong-role moderation cases

UI script:

- idea modal save/delete
- forum post create/edit/pin/delete
- forum reply create/delete
- team forum post create/edit/pin/delete
- team forum reply create/delete
- verify no stale cards remain

Planned artifacts:

- `/Users/ibrobaba/codex/ui-test-tmp/admin-ideas-forums-api-verify.mjs`
- `/Users/ibrobaba/codex/ui-test-tmp/admin-ideas-forums-ui-verify.js`

## Slice 3 - Settings And User Document Management

### Current direct writes

Settings:

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2160`

User document delete:

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:1954`

User role and permission document save:

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2054`

### API work

Add to `/Users/ibrobaba/codex/bsf-website/public/api/admin/mutate.js`:

- `settings.save_all`
- `user.permissions.save`
- `user.delete`

Do not move password reset or auth-user creation in this slice.

### Permissions

- `settings.edit`
- `users.assign_permissions`

### UI rewiring

Replace direct Firestore writes in:

- `saveAllSettings()`
- existing-user branch of `saveTeamMember()`
- pending-user-without-auth branch of `saveTeamMember()`
- remove-user action in `renderTeam()`

### Verification

Direct API script:

- save settings round-trip
- edit existing user roles and overrides
- create pending user doc
- delete user doc
- forbid self-delete

UI script:

- save settings and verify refresh
- edit a user roles/permissions
- create pending user without auth account
- remove that user
- verify audit entries

Planned artifacts:

- `/Users/ibrobaba/codex/ui-test-tmp/admin-settings-users-api-verify.mjs`
- `/Users/ibrobaba/codex/ui-test-tmp/admin-settings-users-ui-verify.js`

## Slice 4 - Auth Account Creation And Password Reset

### Prerequisite

This slice is blocked until a proper Firebase service-account credential is available in Vercel for server-side Auth operations.

### Current client-side auth management

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2087`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2135`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2144`

### API work

Add a dedicated route:

- `/Users/ibrobaba/codex/bsf-website/public/api/admin/team-member.js`

Actions:

- `create_auth_user`
- `send_password_reset`
- optionally `ensure_auth_user`

Do not overload generic `mutate.js` with Firebase Auth admin behavior.

### UI rewiring

Replace client-side auth flows in:

- new-user-with-password branch of `saveTeamMember()`
- `sendTeamPasswordReset()`

Remove `SecondaryApp` usage after cutover.

### Verification

Direct API script:

- create auth user
- duplicate email conflict
- send password reset
- wrong-role rejection

UI script:

- create user with temp password
- optional reset-email branch
- reset-password button
- verify no client-side secondary app remains active

Planned artifacts:

- `/Users/ibrobaba/codex/ui-test-tmp/admin-team-auth-api-verify.mjs`
- `/Users/ibrobaba/codex/ui-test-tmp/admin-team-auth-ui-verify.js`

## Slice 5 - Blog Editor Create, Update, Delete

### Current problem

The review route is already API-backed, but editor CRUD still writes to localStorage for custom posts.

Direct editor code:

- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:2980`
- `/Users/ibrobaba/codex/bsf-website/public/admin/index.html:3048`

### Target

Firestore `blog_posts` becomes the only authoritative admin write path.

Keep the existing review route:

- `/Users/ibrobaba/codex/bsf-website/public/api/admin/blog/review.js`

Move editor CRUD behind API.

### API work

Preferred:

- `/Users/ibrobaba/codex/bsf-website/public/api/admin/blog/editor.js`

Or fold into `mutate.js` only if needed for function-count reasons.

Actions:

- create admin-authored blog post in Firestore
- update Firestore blog post
- if editing a local-only post, create the canonical Firestore post and return its `firestoreId`
- delete canonical Firestore post

LocalStorage should become legacy read support only, not a write source.

### Permissions

- `blog.edit_any`

### UI rewiring

Replace editor-side localStorage and Firestore direct writes in:

- `saveBlogPost()`
- `deleteBlogPost()`

Keep:

- `approveBlogPost()`
- `rejectBlogPost()`

on the existing review route.

### Verification

Direct API script:

- create/update/delete Firestore blog post
- migrate a local-only post to Firestore

UI script:

- create post
- edit post
- delete post
- edit a migrated local-only post
- verify no duplicate rows appear
- verify preview still works
- verify review flow still works unchanged

Planned artifacts:

- `/Users/ibrobaba/codex/ui-test-tmp/admin-blog-editor-api-verify.mjs`
- `/Users/ibrobaba/codex/ui-test-tmp/admin-blog-editor-ui-verify.js`

## Recommended Order

1. communities
2. ideas, forums, team forums
3. settings and user document management
4. blog editor normalization
5. auth account creation and password reset

This order is deliberate:

- it removes remaining direct Firestore CRUD first
- it delays the only slice that needs new privileged credentials
- it avoids mixing localStorage cleanup with Firebase Auth admin work

## Per-Slice Deployment Procedure

For each slice:

1. change only the slice files
2. `git add` only those files
3. commit with a focused message
4. deploy preview from `git archive HEAD`
5. run direct API verification against preview
6. run UI verification against preview
7. if green, deploy the same commit to production
8. rerun UI verification against:
   - `https://public-mu-steel.vercel.app`
9. store reports in `/Users/ibrobaba/codex/ui-test-tmp/results`

## Per-Slice Acceptance Criteria

- targeted API verification passes
- targeted UI verification passes
- Firestore state matches expected mutations
- `consoleErrors: []`
- `pageErrors: []`
- no stale rows or cards remain after delete operations
- audit entries are created for server-routed admin actions

## Rollback

Before every production deploy, note the current production deployment URL.

If a slice fails in preview:

- stop immediately

If a slice fails in production:

- re-alias production to the last known-good deployment
- rerun the last known-good UI verify script

## Suggested Orchestrator

After the next 1-2 slices land, add:

- `/Users/ibrobaba/codex/ui-test-tmp/run-admin-control-plane-suite.sh`

The script should:

- accept `preview` or `prod`
- set the base URL
- run all API verification scripts
- run all UI verification scripts
- stop on first failure
- print a compact summary
- leave JSON reports behind

