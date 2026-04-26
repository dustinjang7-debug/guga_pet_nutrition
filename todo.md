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
- [ ] Catalog of every nutrient column in DB (label_en/zh/th, unit, group)
- [ ] `nutrientProfile()` helper returning every nutrient as TOTAL + per-kg-DM + per-1000-kcal
- [ ] SummaryCard "View full nutrient profile" dialog showing the full grouped table
- [ ] Ca:P ratio helper + display (golden 1.2:1 – 1.4:1, color coded)
