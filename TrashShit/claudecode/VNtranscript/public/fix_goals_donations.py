#!/usr/bin/env python3
"""Fix goals and donation system in Big Sister Foundation site."""

import os

BASE = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# FIX 1a: donate/index.html - match goal by title fallback,
#          read ?amount= and ?idea= params
# ============================================================

donate_path = os.path.join(BASE, 'donate', 'index.html')
with open(donate_path, 'r', encoding='utf-8') as f:
    donate = f.read()

# 1a-i: Add amountParam and ideaParam reading after goalParam
old_goal_param = "      var goalParam = urlParams.get('goal');"
new_goal_param = """      var goalParam = urlParams.get('goal');
      var amountParam = urlParams.get('amount');
      var ideaParam = urlParams.get('idea');"""
assert old_goal_param in donate, "Could not find goalParam line in donate"
donate = donate.replace(old_goal_param, new_goal_param, 1)

# 1a-ii: Fix goal matching to also try title (case-insensitive)
old_match = """        if (goalParam) {
          var matched = goals.filter(function (g) { return g.id === goalParam; })[0];
          if (matched && matched.status === 'active') {
            selectGoal(matched);
            document.getElementById('checkout').scrollIntoView({ behavior: 'smooth' });
          }
        }"""
new_match = """        if (goalParam) {
          var matched = goals.filter(function (g) { return g.id === goalParam; })[0];
          if (!matched) {
            var goalLower = decodeURIComponent(goalParam).toLowerCase();
            matched = goals.filter(function (g) { return (g.title || '').toLowerCase() === goalLower; })[0];
          }
          if (matched && matched.status === 'active') {
            selectGoal(matched);
            if (amountParam) {
              var amt = parseInt(amountParam);
              if (amt > 0) document.getElementById('total-amount').value = amt;
            }
            document.getElementById('checkout').scrollIntoView({ behavior: 'smooth' });
          }
        }
        if (ideaParam && !goalParam) {
          var ideaLower = decodeURIComponent(ideaParam).toLowerCase();
          var ideaGoal = goals.filter(function (g) { return (g.title || '').toLowerCase() === ideaLower; })[0];
          if (ideaGoal && ideaGoal.fund) {
            var pill = document.querySelector('.fund-pill[data-fund=\"' + ideaGoal.fund + '\"]');
            if (pill) {
              document.querySelectorAll('.fund-pill').forEach(function (p) { p.classList.remove('is-active'); });
              pill.classList.add('is-active');
              selectedFund = ideaGoal.fund;
            }
          }
        }
        if (amountParam && !goalParam) {
          var preAmt = parseInt(amountParam);
          if (preAmt > 0) document.getElementById('total-amount').value = preAmt;
        }"""
assert old_match in donate, "Could not find goal matching block in donate"
donate = donate.replace(old_match, new_match, 1)

# ============================================================
# FIX 2a: donate/index.html - non-financial goal support in
#          createGoalCard and localGoals
# ============================================================

# Add 2 non-financial goals to localGoals
old_local_goals_end = """        { id: 'local-goal-4', title: 'Art Therapy for Trauma Survivors', description: 'Weekly art therapy sessions led by a trained therapist for children who have experienced abuse or displacement.', pathway: 'difficult-backgrounds', fund: 'counselling', targetAmount: 200000, raisedAmount: 85000, status: 'active', deadline: '2026-07-31', sponsors: 5, child: 'Trauma Support Group' }
      ];"""
new_local_goals_end = """        { id: 'local-goal-4', title: 'Art Therapy for Trauma Survivors', description: 'Weekly art therapy sessions led by a trained therapist for children who have experienced abuse or displacement.', pathway: 'difficult-backgrounds', fund: 'counselling', targetAmount: 200000, raisedAmount: 85000, status: 'active', deadline: '2026-07-31', sponsors: 5, child: 'Trauma Support Group' },
        { id: 'local-goal-5', title: 'Weekend Mentorship Programme', description: 'Recruit and train mentors to guide young people through weekend sessions covering life skills, career planning, and personal development.', pathway: 'general', fund: 'counselling', goalType: 'volunteer', targetCapacity: 20, raisedCapacity: 8, unit: 'mentors', status: 'active', deadline: '2026-09-30', sponsors: 4, child: '' },
        { id: 'local-goal-6', title: 'Community Outreach Drive', description: 'Reach 500 families across underserved communities with information about BSF programmes, enrollment support, and resource packs.', pathway: 'difficult-backgrounds', fund: 'food', goalType: 'outreach', targetCapacity: 500, raisedCapacity: 120, unit: 'families', status: 'active', deadline: '2026-08-15', sponsors: 6, child: '' }
      ];"""
assert old_local_goals_end in donate, "Could not find local goals end in donate"
donate = donate.replace(old_local_goals_end, new_local_goals_end, 1)

# Modify createGoalCard to handle non-financial goals
# Replace the progress stats section that shows "raised" and "remaining"
old_progress = """        var pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.raisedAmount / goal.targetAmount) * 100)) : 0;
        var remaining = Math.max(0, goal.targetAmount - goal.raisedAmount);"""
new_progress = """        var isNonFinancial = goal.goalType && goal.goalType !== 'financial';
        var effectiveTarget = isNonFinancial ? (goal.targetCapacity || 0) : (goal.targetAmount || 0);
        var effectiveRaised = isNonFinancial ? (goal.raisedCapacity || 0) : (goal.raisedAmount || 0);
        var pct = effectiveTarget > 0 ? Math.min(100, Math.round((effectiveRaised / effectiveTarget) * 100)) : 0;
        var remaining = Math.max(0, effectiveTarget - effectiveRaised);"""
assert old_progress in donate, "Could not find progress calculation in donate"
donate = donate.replace(old_progress, new_progress, 1)

# Replace raised text
old_raised = "        raised.textContent = fmt(goal.raisedAmount) + ' raised';"
new_raised = """        if (isNonFinancial) {
          var unitLabels = { 'volunteer': 'volunteers signed up', 'outreach': (goal.unit || 'people') + ' reached', 'mentoring': 'mentors enrolled' };
          raised.textContent = effectiveRaised + ' ' + (unitLabels[goal.goalType] || (goal.unit || 'units') + ' pledged');
        } else {
          raised.textContent = fmt(goal.raisedAmount) + ' raised';
        }"""
assert old_raised in donate, "Could not find raised text in donate"
donate = donate.replace(old_raised, new_raised, 1)

# Replace remaining text
old_rem = "        rem.textContent = goal.status === 'funded' ? 'Goal reached!' : fmt(remaining) + ' to go';";
new_rem = """        if (isNonFinancial) {
          rem.textContent = goal.status === 'funded' ? 'Goal reached!' : remaining + ' ' + (goal.unit || 'more') + ' to go';
        } else {
          rem.textContent = goal.status === 'funded' ? 'Goal reached!' : fmt(remaining) + ' to go';
        }"""
assert old_rem in donate, "Could not find remaining text in donate"
donate = donate.replace(old_rem, new_rem, 1)

# Replace CTA button for non-financial goals
old_cta = """          cta.textContent = 'Fund This Goal — ' + fmt(remaining) + ' needed';
          cta.addEventListener('click', function () {
            selectGoal(goal);
            document.getElementById('checkout').scrollIntoView({ behavior: 'smooth' });
          });"""
new_cta = """          if (isNonFinancial) {
            cta.textContent = 'Pledge — ' + remaining + ' ' + (goal.unit || 'more') + ' needed';
            cta.addEventListener('click', function () {
              window.location.href = '/volunteer/?goal=' + encodeURIComponent(goal.id);
            });
          } else {
            cta.textContent = 'Fund This Goal — ' + fmt(remaining) + ' needed';
            cta.addEventListener('click', function () {
              selectGoal(goal);
              document.getElementById('checkout').scrollIntoView({ behavior: 'smooth' });
            });
          }"""
assert old_cta in donate, "Could not find CTA block in donate"
donate = donate.replace(old_cta, new_cta, 1)

with open(donate_path, 'w', encoding='utf-8') as f:
    f.write(donate)
print("[OK] donate/index.html updated")

# ============================================================
# FIX 2b: sponsor/dashboard.html - non-financial goal support
# ============================================================

dashboard_path = os.path.join(BASE, 'sponsor', 'dashboard.html')
with open(dashboard_path, 'r', encoding='utf-8') as f:
    dashboard = f.read()

# Replace the goal card rendering in sponsor dashboard
old_dashboard_amounts = """          var target = goal.targetAmount || 0;
          var raised = goal.raisedAmount || 0;
          var pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;"""
new_dashboard_amounts = """          var isNonFinancial = goal.goalType && goal.goalType !== 'financial';
          var target = isNonFinancial ? (goal.targetCapacity || 0) : (goal.targetAmount || 0);
          var raised = isNonFinancial ? (goal.raisedCapacity || 0) : (goal.raisedAmount || 0);
          var pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;"""
assert old_dashboard_amounts in dashboard, "Could not find dashboard amounts block"
dashboard = dashboard.replace(old_dashboard_amounts, new_dashboard_amounts, 1)

# Replace the raised display
old_dashboard_raised = """          raisedStrong.textContent = 'NGN ' + Number(raised).toLocaleString();
          raisedSpan.appendChild(raisedStrong);
          raisedSpan.appendChild(document.createTextNode(' raised'));"""
new_dashboard_raised = """          if (isNonFinancial) {
            var unitLabels = { 'volunteer': 'volunteers signed up', 'outreach': (goal.unit || 'people') + ' reached', 'mentoring': 'mentors enrolled' };
            raisedStrong.textContent = raised;
            raisedSpan.appendChild(raisedStrong);
            raisedSpan.appendChild(document.createTextNode(' ' + (unitLabels[goal.goalType] || (goal.unit || 'units') + ' pledged')));
          } else {
            raisedStrong.textContent = 'NGN ' + Number(raised).toLocaleString();
            raisedSpan.appendChild(raisedStrong);
            raisedSpan.appendChild(document.createTextNode(' raised'));
          }"""
assert old_dashboard_raised in dashboard, "Could not find dashboard raised block"
dashboard = dashboard.replace(old_dashboard_raised, new_dashboard_raised, 1)

# Replace target display
old_dashboard_target = "          targetSpan.textContent = 'Goal: NGN ' + Number(target).toLocaleString();"
new_dashboard_target = """          if (isNonFinancial) {
            targetSpan.textContent = 'Goal: ' + target + ' ' + (goal.unit || 'units');
          } else {
            targetSpan.textContent = 'Goal: NGN ' + Number(target).toLocaleString();
          }"""
assert old_dashboard_target in dashboard, "Could not find dashboard target text"
dashboard = dashboard.replace(old_dashboard_target, new_dashboard_target, 1)

# Replace CTA button
old_dashboard_btn = """          btn.textContent = 'Contribute to This Goal';
          btn.onclick = function() {
            var remaining = target - raised;
            window.location.href = '/donate/?goal=' + encodeURIComponent(goal.title || '') + '&amount=' + Math.max(0, remaining);
          };"""
new_dashboard_btn = """          if (isNonFinancial) {
            btn.textContent = 'Pledge for This Goal';
            btn.onclick = function() {
              window.location.href = '/volunteer/?goal=' + encodeURIComponent(goal.id || goal.title || '');
            };
          } else {
            btn.textContent = 'Contribute to This Goal';
            btn.onclick = function() {
              var remaining = target - raised;
              window.location.href = '/donate/?goal=' + encodeURIComponent(goal.title || '') + '&amount=' + Math.max(0, remaining);
            };
          }"""
assert old_dashboard_btn in dashboard, "Could not find dashboard button block"
dashboard = dashboard.replace(old_dashboard_btn, new_dashboard_btn, 1)

with open(dashboard_path, 'w', encoding='utf-8') as f:
    f.write(dashboard)
print("[OK] sponsor/dashboard.html updated")

# ============================================================
# FIX 2c: admin/index.html - add non-financial goals to seed
# ============================================================

admin_path = os.path.join(BASE, 'admin', 'index.html')
with open(admin_path, 'r', encoding='utf-8') as f:
    admin = f.read()

old_seed = """      {title:'Computer Lab for Saturday Classes',target:2000000,raised:150000,currentValue:150000,targetValue:2000000,status:'active',category:'technology',unit:'NGN',description:'Set up a fully equipped computer lab with 20 workstations, internet access, and educational software to teach digital literacy during our Saturday classes.',createdAt:FieldValue.serverTimestamp(),lastEditedAt:FieldValue.serverTimestamp()}
    ];"""
new_seed = """      {title:'Computer Lab for Saturday Classes',target:2000000,raised:150000,currentValue:150000,targetValue:2000000,status:'active',category:'technology',unit:'NGN',description:'Set up a fully equipped computer lab with 20 workstations, internet access, and educational software to teach digital literacy during our Saturday classes.',createdAt:FieldValue.serverTimestamp(),lastEditedAt:FieldValue.serverTimestamp()},
      {title:'Weekend Mentorship Programme',goalType:'volunteer',targetCapacity:20,raisedCapacity:8,unit:'mentors',status:'active',category:'community',description:'Recruit and train mentors to guide young people through weekend sessions covering life skills, career planning, and personal development.',createdAt:FieldValue.serverTimestamp(),lastEditedAt:FieldValue.serverTimestamp()},
      {title:'Community Outreach Drive',goalType:'outreach',targetCapacity:500,raisedCapacity:120,unit:'families',status:'active',category:'outreach',description:'Reach 500 families across underserved communities with information about BSF programmes, enrollment support, and resource packs.',createdAt:FieldValue.serverTimestamp(),lastEditedAt:FieldValue.serverTimestamp()}
    ];"""
assert old_seed in admin, "Could not find seed goals end in admin"
admin = admin.replace(old_seed, new_seed, 1)

# Update the console log count
old_log = "      console.log('[Admin] Seeded 3 sample goals.');"
new_log = "      console.log('[Admin] Seeded 5 sample goals.');"
assert old_log in admin, "Could not find seed log in admin"
admin = admin.replace(old_log, new_log, 1)

with open(admin_path, 'w', encoding='utf-8') as f:
    f.write(admin)
print("[OK] admin/index.html updated")

print("\nAll fixes applied successfully.")
