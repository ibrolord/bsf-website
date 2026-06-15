# Big Sister Foundation — Brand Assets

Source-of-truth brand materials for BSF, tracked in the repo. The live site
(`public/`) implements these. When the site and these files disagree, **these
files win** — update the site to match.

> Tagline: **Rooted · Present · Protective**

---

## Structure

```
assets/brand/
├── final/          Canonical brand guide (use these)
├── templates/      Ready-to-use branded stationery (letterhead, etc.)
├── archive/        Superseded earlier versions, kept for history
└── explorations/   Concept, recommendation, and reference PDFs that informed the final
```

### `templates/` — ready-to-use stationery
| File | What it is |
|------|-----------|
| `letterhead.html` | Print-ready A4 letterhead. Edit in any browser → File → Print → Save as PDF (enable "Background graphics"). Uses the canonical Young Serif / Lora / Instrument Sans stack via Google Fonts. |
| `letterhead.docx` | Editable Microsoft Word version of the same letterhead. Fonts fall back to Georgia if Young Serif / Lora aren't installed locally. |

Contact block printed on stationery: Lagos, Nigeria · +1 289-968-0152 ·
hello@thebigsisterfoundation.org · thebigsisterfoundation.org

### `final/` — canonical
| File | What it is |
|------|-----------|
| `Brand_Guide.pdf` | **Primary reference.** 17-page polished guide — "Our Model" pathways, worked sample ledger entry, full transparency story. |
| `Brand_Guide.pptx` | Editable source deck (17 slides): founder "iroko tree" story, mission/vision, RGB+CMYK specs, audience segmentation, photography direction. |

### `archive/` — superseded
| File | What it is |
|------|-----------|
| `Brand_Guide_v1.pdf` | Earlier 12-page guide. Replaced by `final/Brand_Guide.pdf`. |
| `Brand_Guide_v1.pptx` | Source deck for the v1 guide. |

### `explorations/` — reference only, NOT current brand
Concept work that informed the final guide. `BSF_Vibrant_Colour_v3.pdf`
(Danfo Orange / Zobo Magenta / Electric Indigo) is a *proposed* bold rebrand
direction — do not use in production unless that rebrand is formally adopted.

---

## Canonical color palette

Consistent across every guide and matches `public/SITE_DOC.md` §9.

| Name | Hex | RGB | Use |
|------|-----|-----|-----|
| Iroko Green | `#2D5E40` | 45, 94, 64 | Primary — headings, logo, buttons |
| Deep Brown | `#3A2A1F` | 58, 42, 31 | Body text, dark backgrounds |
| Warm Terracotta | `#C2734C` | 194, 115, 76 | Accents, CTAs, links |
| Harvest Gold | `#D4A96A` | — | Secondary accent, taglines, decorative |
| Leaf Light / Sage | `#8BAF8E` | — | Supporting green, hover states |
| Warm Cream | `#FFF8F0` | — | Page backgrounds |

Logo: stylised iroko tree ("the sheltering tree"). Default to green-on-light;
brown and reversed (white-on-green / white-on-brown) variants are in the deck.

---

## ⚠️ Unresolved: typography is not settled

The brand assets and the live site specify **three different type systems**:

| Source | Headings | Body |
|--------|----------|------|
| `final/Brand_Guide.pptx` | Young Serif (web fallback: Georgia) | Lora + Instrument Sans (UI) |
| `archive/Brand_Guide_v1.pdf` | Georgia | Calibri |
| Live site (`public/shared/bsf-fonts.css`) | EB Garamond | system-ui |

Colors are locked; **type is not**. Pick one canonical system before new design
work, then align the other sources. Until then, the live site ships EB Garamond.

---

## Contact

Brand assets, questions, partnership inquiries: princebolajibreeze@gmail.com
