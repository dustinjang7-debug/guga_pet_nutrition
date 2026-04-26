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

- [ ] 12-step wizard (Protein → Carbs → Vit A → Vit B → Choline → Vit E → Vit D → Iron → Zinc → Calcium → Phosphorus → Sodium)
- [ ] Suggestion cards with default ingredients (chicken liver, brewer's yeast, egg yolk, eggshell powder, etc.)
- [ ] Top-N sortable lists for each nutrient step

## v0.3 — Simple Composer enhancements

- [ ] Auto-suggest food additives to close AAFCO gaps (eggshell powder, salt, oils, brewer's yeast)

## v0.4 — Export & polish

- [ ] PDF export (full ingredient list + nutrient summary, GUGA-branded)
- [ ] CSV export
- [ ] Recipe duplication and versioning
- [ ] Side-by-side recipe comparison
- [ ] GUGA brand colors and logo

## v1.0 — Cat-essential nutrients (deferred)

- [ ] Add taurine, methionine, arginine columns to ingredient DB
- [ ] Update AAFCO Cat profile to include taurine minimum
