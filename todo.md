# GUGA Pet Meal Nutrition Calculator — TODO

## v0.1 (current build) — Calculator core

- [x] Ingredient database imported from verified Google Sheet (238 rows, EN/ZH/TH, categorized)
- [x] AAFCO Dog + Cat profiles (Adult Maintenance + Growth/Reproduction) with min/max per kg DM
- [x] Life-stage factors for both species (NRC + Chinese reference)
- [x] Calculation engine (recipe totals, DM%, ME%, AAFCO comparison, daily feeding & water)
- [x] Pet Profile inputs (species, body weight, life stage, factor, feeding mode, pet name/ID)
- [x] Sticky Volume tracker (starting volume, used, remaining)
- [x] Macro target inputs (Protein %, Carb %, Fat auto-calculated) with green/yellow/red benchmark zones
- [x] Sortable + filterable + searchable Ingredient Picker
- [x] Live AAFCO Compliance dashboard (per-nutrient status, DM and per-1000-kcal bases)
- [x] Summary card (total weight, kcal, energy density, moisture, daily feeding, water from food, water still needed)
- [x] Save / load recipes per user (Manus OAuth + MySQL)
- [x] Trilingual UI toggle (EN / 中文 / ไทย)
- [x] Vitest tests for calc engine + AAFCO logic (16 tests passing)

## v0.2 — Guided Wizard (next iteration)

- [x] 13-step wizard config (shared/wizard.ts)
- [x] Build WizardPage with progress bar + step cards (Accept/Change/Skip/Back)
- [x] Live AAFCO delta per step against target nutrient
- [x] Routes `/wizard/new` and `/wizard/:id`; CTA on Home + AppShell
- [x] Step 14: Compliance Check — list every still-unmet AAFCO nutrient with two remediation paths per gap (fresh ingredient OR food additive)
- [x] On finish → save dialog (or open Simple Composer to fine-tune)
- [x] Reuse additive suggester as Auto-fix chips + sheet in Simple Composer's AafcoPanel
- [x] Vitest tests for nutrient-gap-suggester (11 tests passing)
- [x] Fixed broken /new and /recipes/:id routes — canonical /recipe/new + /recipe/:id

## v0.3 — Simple Composer enhancements

- [x] Auto-suggest food additives to close AAFCO gaps (eggshell powder, salt, oils, brewer's yeast)

## v0.4 — Export & polish

- [ ] PDF export (full ingredient list + nutrient summary, GUGA-branded)
- [ ] CSV export
- [ ] Recipe duplication and versioning
- [ ] Side-by-side recipe comparison
- [ ] GUGA brand colors and logo

## v1.0 — Cat-essential nutrients (deferred)

- [ ] Add taurine, methionine, arginine columns to ingredient DB
- [ ] Update AAFCO Cat profile to include taurine minimum

## Bugs reported

- [x] React warning: `<a>` cannot contain a nested `<a>` (AppShell logo wraps Link incorrectly)
- [ ] Verify nested-anchor warning is gone after browser hard-refresh
- [ ] User to publish once v0.2 is done so manus.space domain serves latest build

## Bugs reported (v0.2 mobile)

- [x] AppShell header overflows on iPhone width — rewrote with hamburger menu under md, single-button language cycler, hidden tagline
- [x] WizardPage cards overlap on mobile width — sticky only at lg+, removed double padding from custom container
- [ ] User to re-publish after mobile fixes

## v0.2.2 — Full nutrient profile + free ingredient search + Ca:P ratio (user request)

- [x] **Bug fix**: Wizard `addOrUpdateItem` was double-counting on repeated Add clicks — split into `upsertItem` (Wizard suggestion: replace) and `incrementItem` (Compliance Check: top up)
- [x] Wizard step: free ingredient search across all 238 items (EN/ZH/TH name match)
- [x] Vitest reactivity contract test (5 tests, all 32 passing)
- [x] Catalog of every nutrient column in DB (label_en/zh/th, unit, group)
- [x] `nutrientProfile()` helper returning every nutrient as TOTAL + per-kg-DM + per-1000-kcal
- [x] SummaryCard "View full nutrient profile" dialog showing the full grouped table
- [x] Ca:P ratio helper + display (golden 1.2:1 – 1.4:1, color coded with visual band)
- [x] Vitest tests (12 new) for caPhosphorusRatio + nutrientProfile (44/44 passing)

## v0.2.3 — UX + carb gate (DONE)

- [x] Carb kcal-share helper: % of total kcal from carbs (carb_g × 4 / kcal × 100)
- [x] Carb status classifier with user bands:
      Dog: optimal 20–30%, ok 30–40%, alert <20% or >40%
      Cat: optimal 0–10%, ok 10–20%, alert ≥20%
- [x] Wizard carb step shows live kcal-share badge (CarbKcalShareBadge) with status colors
- [x] AafcoPanel: dropped Status column — whole row colored red/green/orange
- [x] Removed per-1000-kcal column + ME basis toggle
- [x] Removed per-1000-kcal column from Full Nutrient Profile dialog
- [x] Pet Profile card: collapses to one-line summary once filled; Edit chip to reopen
- [x] SummaryCard: collapses to one-line summary (kcal/g/Ca:P)
- [x] Recipe Items list now sits side-by-side with picker on xl+
- [x] Created StartingVolumeStrip + relocated under AafcoPanel
- [x] Vitest tests for carbKcalShare — 17 tests, total 61/61 passing

## v0.2.4 — Final layout re-arrangement (DONE)

- [x] StartingVolumeStrip collapsible (default collapsed, header chevron, progress bar always visible)
- [x] Macro-targets section collapsible (default collapsed) with one-line P/C/F summary
- [x] Re-arrange RecipeBuilder: left rail = PetProfile + Summary + RecipeItemsList (stacked)
- [x] Center = IngredientPicker only (sticky, full viewport height)
- [x] Right = AafcoPanel + collapsed StartingVolumeStrip + collapsed Macro Targets
- [x] Status band (red/green/orange) added to AafcoFixSheet header

## v0.2.6 — AAFCO unit-mismatch bug (DONE)

- [x] Audit AAFCO threshold units vs ingredient nutrient units
- [x] Fix unit conversion in computeAafco (calc.ts) — labeled mg/kg DM, removed divide-by-1000
- [x] Regression test: 6g eggshell in ~700g recipe → Ca above min
- [x] Verify B12 (μg), P/Na (mg/kg DM) thresholds

## v0.2.7 — Data audit (DONE — read-only)

- [x] USDA FDC lookup for chicken liver / raw oyster / egg yolk
- [x] Side-by-side comparison report at /home/ubuntu/usda_vs_guga_3.md
- [x] DB NOT modified

## v0.3 — USDA FDC review (read-only — live DB never modified)

- [x] Verify uploaded SR Legacy CSV bundle (FoodData_Central_sr_legacy_food_csv_2018-04.zip)
- [x] First-pass name-matching script: GUGA 238 → FDC food entries
- [ ] Enhance matcher with HIGH_OK / NEEDS_REVIEW / NO_USDA_MATCH flags
- [ ] Provide top-5 alternative FDC candidates per ambiguous row
- [ ] Generate matches_review.csv for user manual review
- [ ] Generate Markdown summary grouped by category
- [ ] Niacin already exists as `niacin_mg` (FDC nutrient 1167)
- [ ] User picks correct matches; no DB swap until then

## v0.3.1 — USDA review round 2 (read-only)

- [ ] Parse guga_usda_decisions.json from user
- [ ] Lock in accepted matches into a "decisions ledger"
- [ ] Rewrite matcher v3: noun-priority scoring, Foundation as tiebreaker not override
- [ ] Re-run only on skipped/no-match rows
- [ ] Build round-2 review tool with shortlisted rows only
- [ ] User reviews round 2 → final decisions JSON

## v0.3.2 — Wizard B-vitamin overhaul

- [x] Wizard B-vitamin step: replace single B1 check with all B vitamins (B1, B2, B3/niacin, B5, B6, B12, folate — NOT choline; choline has its own step) vs AAFCO benchmarks
- [x] If any B vitamin below min → suggest brewer's yeast (cap suggested amount at 2% of total recipe weight)
- [x] Step shows green only when ALL B vitamins meet AAFCO
- [x] Vitest tests for the new B-vitamin gap detector
- [x] Relax handCalcAudit B12 sanity assertion (DB-as-source-of-truth per product decision)

## v0.3.3 — Wizard layout restructure

- [x] Wizard: dedicated setup screen for pet profile + starting volume (entered first; user proceeds to step 1)
- [x] On step screens: show pet profile + starting volume as compact text line above the step header (with Edit link to return to setup screen)
- [x] Column order on step screens (left → right): Summary (collapsed) + Current Recipe (open) | Ingredient Picker | AAFCO compliance panel
- [x] Left rail: Summary collapsed by default
- [x] Left rail: Current Recipe panel rendered open directly below Summary

## v0.3.4 — Simple Composer save bug

- [x] Fix 404 after save: navigate target was /recipes/:id (plural) but route is /recipe/:id (singular)

## v0.3.5 — SummaryCard P/F/C% visibility

- [x] Show P/F/C% in collapsed one-line (DM basis, small label)
- [x] Show P/F/C% as 3-col grid in expanded body, with ME-basis line underneath

## v0.3.6 — Scale to starting volume

- [x] Add proportional scale-to-volume action that rescales all items so total = startingVolume
- [x] Surface action on Current Recipe card in Simple Composer (RecipeBuilder)
- [x] Surface action on Current Recipe card in Wizard (RecipeSoFar)
- [x] Off-target indicator (amber total + filled button) when total ≠ startingVolume

## v0.3.7 — Guaranteed-analysis label

- [x] Remove ME% line from expanded SummaryCard
- [x] Add guaranteed-analysis panel (Protein / Fat / Carb NFE / Crude fiber / Ash approx / Moisture) on DM basis
- [x] Keep collapsed view as P/F/C DM% only
- [x] Extend RecipeMacros with fiberPct_DM + ashPct_DM (derived) + absolute grams
