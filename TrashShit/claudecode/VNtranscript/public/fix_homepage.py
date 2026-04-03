#!/usr/bin/env python3
"""Fix homepage issues: update Let's Talk button and enhance tree illustration."""

import re

FILE = '/Users/ibrobaba/TrashShit/claudecode/VNtranscript/public/index.html'

with open(FILE, 'r') as f:
    content = f.read()

# =============================================================
# FIX 1: Change "Let's Talk" button from WhatsApp to mailto
# =============================================================

# The hero "Let's Talk" button (line ~1056)
content = content.replace(
    '<a href="https://wa.me/2348000000000" class="btn btn--terra">Let\'s Talk</a>',
    '<a href="mailto:princebolajibreeze@gmail.com?subject=Let\'s Talk — Big Sister Foundation" class="btn btn--terra">Let\'s Talk</a>'
)

# =============================================================
# FIX 2: Make the tree illustration bigger and nicer
# =============================================================

# 2a. Update .tree-bg dimensions and positioning
content = content.replace(
    """.tree-bg {
      position: fixed;
      top: 0;
      right: 5%;
      width: 200px;
      height: 100vh;
      pointer-events: none;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
    }""",
    """.tree-bg {
      position: fixed;
      top: 0;
      right: -2vw;
      width: clamp(300px, 35vw, 500px);
      height: 100vh;
      pointer-events: none;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
    }"""
)

# 2b. Add drop-shadow filter to .tree-bg svg
content = content.replace(
    """.tree-bg svg {
      width: 100%;
      height: 90vh;
    }""",
    """.tree-bg svg {
      width: 100%;
      height: 90vh;
      filter: drop-shadow(0 0 20px rgba(45,94,64,0.08));
    }"""
)

# 2c. Increase .tree-trunk stroke-width from 3 to 5, opacity from 0.2 to 0.28
content = content.replace(
    """.tree-trunk {
      fill: none;
      stroke: var(--brown);
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.2;
      stroke-width: 3;
    }""",
    """.tree-trunk {
      fill: none;
      stroke: var(--brown);
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.28;
      stroke-width: 5;
    }"""
)

# 2d. Increase .tree-root stroke-width from 1.5 to 3, opacity from 0.15 to 0.22
content = content.replace(
    """.tree-root {
      fill: none;
      stroke: var(--brown);
      stroke-linecap: round;
      stroke-width: 1.5;
      opacity: 0.15;
    }""",
    """.tree-root {
      fill: none;
      stroke: var(--brown);
      stroke-linecap: round;
      stroke-width: 3;
      opacity: 0.22;
    }"""
)

# 2e. Increase .tree-branch stroke-width from 2 to 3.5, opacity from 0.18 to 0.25
content = content.replace(
    """.tree-branch {
      fill: none;
      stroke: #2D5E40;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
      opacity: 0.18;
    }""",
    """.tree-branch {
      fill: none;
      stroke: #2D5E40;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 3.5;
      opacity: 0.25;
    }"""
)

# 2f. Increase .tree-leaf opacity from 0.15 to 0.22 (in .tree-leaf.is-shown)
content = content.replace(
    """.tree-leaf.is-shown {
      opacity: 0.15;
      transform: scale(1);
    }""",
    """.tree-leaf.is-shown {
      opacity: 0.22;
      transform: scale(1);
    }"""
)

# 2g. Update reduced-motion styles to match new opacities
content = content.replace(
    '.tree-leaf { opacity: 0.15 !important; transform: scale(1) !important; }',
    '.tree-leaf { opacity: 0.22 !important; transform: scale(1) !important; }'
)

with open(FILE, 'w') as f:
    f.write(content)

print("All fixes applied successfully.")
print("  - Let's Talk button now links to mailto instead of WhatsApp")
print("  - Tree: .tree-bg width increased to clamp(300px, 35vw, 500px), right: -2vw")
print("  - Tree: drop-shadow filter added to .tree-bg svg")
print("  - Tree: trunk stroke-width 3->5, opacity 0.2->0.28")
print("  - Tree: root stroke-width 1.5->3, opacity 0.15->0.22")
print("  - Tree: branch stroke-width 2->3.5, opacity 0.18->0.25")
print("  - Tree: leaf is-shown opacity 0.15->0.22")
