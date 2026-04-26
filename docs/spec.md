# GUGA Pet Meal Nutrition Calculator — Final Spec (v1)

This document consolidates every decision Disk locked in over the requirements interview. Everything below is what will be built once Disk signs off. Anything not in this document is **out of scope for v1** and recorded as a note for v2.

---

## 1. Mission

A web app that lets a GUGA nutritionist design a complete and balanced fresh-food meal for a dog or cat and see, in real time, how the recipe compares to AAFCO standards. The app must accelerate the recipe-building process the nutritionist currently does inside an awkward Chinese Excel sheet, fix the sorting and visibility pain points, and produce a downloadable PDF spec sheet at the end.

---

## 2. Languages

The UI supports three languages with a top-bar toggle: **English (default), 简体中文, ไทย**. Every label, button, ingredient name, life-stage label, nutrient label, and AAFCO note is translated. Numbers, units, and the AAFCO reference values themselves are language-independent.

The ingredient database stores three name fields per row (`name_zh`, `name_en`, `name_th`) plus an internal numeric ID that never changes — this ID is what the recipe references, so a recipe stays consistent regardless of display language.

---

## 3. Authentication and persistence

Authentication uses **Manus OAuth** (one-click). Every saved recipe is bound to the signed-in user with a creation timestamp. Recipes are private to the user; there is no sharing, team workspace, or admin role in v1.

Storage is a Postgres database upgraded onto this project via `web-db-user`. Schema is sketched in §11.

---

## 4. The verified ingredient database

238 rows × 30 nutrient columns, all values per **100 g raw edible portion**. Disk has personally verified the data. Locked as the source of truth. Truncated names already corrected. Units already audited.

The database is read-only inside the app (the nutritionist consumes it; she does not edit it). A future v2 can add custom-ingredient creation.

---

## 5. Pet profile inputs

The nutritionist starts every new recipe by entering the pet profile. These inputs drive the AAFCO target values, DER, water need, and macro-target validation.

| Field | Type | Notes |
|---|---|---|
| Pet name / ID | text | Optional. For client tracking. |
| Species | radio | Dog · Cat |
| Body weight | number, kg | Decimals allowed. |
| Life stage | dropdown | Dog options: Puppy <4 mo, Puppy 4 mo→adult, Adult intact, Adult neutered, Adult obese-prone, Adult weight-loss, Pregnant >day 21, Lactating, Light work, Moderate work, Heavy work. Cat options: Kitten, Adult intact, Adult neutered, Adult obese-prone, Adult weight-loss, Active, Pregnant, Lactating. |
| Sub-modifier | slider | Only appears when the chosen life stage has a range (Lactating dog 4–8, Lactating cat 2–6, Pregnant cat 1.6–2.0, Adult weight-loss cat 0.8–1.0). |
| Macro mode | radio | Normal · Weight loss — drives the macro-range guide. |
| Target Protein | range slider, % DM | Defaults from §5.1 below. |
| Target Carb | range slider, % DM | Defaults from §5.1 below. Fat is auto = 100 − P − C. |

### 5.1 Macro-range benchmarks (locked from Disk)

| | **Dogs** | **Cats** |
|---|---|---|
| Protein | 40–50% | >50% |
| Fat (normal) | 15–20% | 20–30% |
| Fat (weight-loss) | <10% | 9–15% |
| Carb (optimum) | 20–30% | <10% |
| Carb (acceptable) | 30–40% | 10–20% |

The UI shows three colour zones on each macro slider — green (optimum), yellow (acceptable), red (out of range). Fat updates live as P and C are adjusted; if Fat falls outside its range, Fat's badge turns yellow or red.

---

## 6. Recipe canvas — sticky volume tracker

The user sets a **starting volume** (default 1000 g, editable). A persistent header card shows three numbers at all times, regardless of which workflow or panel is active:

```
Volume used:    342 g   (of 1000 g)
Volume left:    658 g   ───────────────█████████░░░░░░░░░
Energy density: 1.62 kcal/g       Daily feed: 184 g
```

Volume left is computed live and never lets the nutritionist exceed 100% (the Add button disables when an attempted addition would push past the cap; she can either reduce other ingredients or raise the starting volume).

---

## 7. Ingredient picker — sort, filter, search

A two-row control bar above the ingredient list:

**Row 1 — Filter chips** (one-click, multi-select): Protein · Organ · Fish/Seafood · Egg/Dairy · Grain · Root · Vegetable · Fruit · Oil · Nut/Seed · Mushroom · Supplement · All. A **search box** matches any of the three name fields.

**Row 2 — Rank by**: dropdown of every nutrient (Protein, Fat, Vit A, Choline, Iron, Ca, P, …) plus *Alphabetical* and *Most-used by this user*. Direction toggle ↑ ↓. When a nutrient is selected, each ingredient row displays that nutrient's per-100 g value as both a number and a small bar so the nutritionist can scan visually.

The current recipe view echoes the same column. Sorting the recipe by, say, "Vit A" reveals which ingredients in *this* recipe are doing the heavy lifting for that nutrient.

---

## 8. AAFCO live dashboard

A right-hand panel always visible, showing for every tracked nutrient: **Total in recipe**, **per kg DM**, **per 1000 kcal ME**, and the **AAFCO min / max** for the selected species + life stage. Colour-coded:

- 🟢 within range
- 🟡 within 10% of min (borderline)
- 🔴 below min or above max
- ⚪ no AAFCO requirement defined for this species/nutrient

Updates run **on every ingredient add, remove, or gram change** — no recompute button. The same panel shows DER (kcal/day), water need (mL/day, energy-coupled), water from food (mL), and water still needed from bowl (mL).

Macro readouts (Protein %, Fat %, Carb %, all % DM) appear at the top of the panel with the green/yellow/red zone badge from §5.1. A second tab toggles the macros to **% of metabolisable energy** using modified Atwater (P=3.5, F=8.5, C=3.5 kcal/g).

---

## 9. Workflow 1 — Guided Fresh Ingredient Wizard

A 12-step wizard. Each step is a recommendation card. The card explains the goal, suggests an ingredient (or top 5 ranked by relevant nutrient density), shows a recommended gram amount, and gives the nutritionist three buttons: **Add to recipe**, **Pick a different one** (opens the picker pre-filtered by relevant nutrient), **Skip / already covered**. After Add, the AAFCO dashboard updates instantly and the wizard advances. The nutritionist can navigate forward/backward at any time and edit prior selections.

| Step | Goal | Default suggestion | Logic |
|---|---|---|---|
| 1 | Protein source | Picker pre-filtered to Protein category, ranked by protein density | Add until target protein % is hit, but stop at the protein band's upper edge. |
| 2a | Carb — Grain | Picker pre-filtered to Grain | Suggest 50% of carb target (override allowed). |
| 2b | Carb — Root | Picker pre-filtered to Root | Suggest 50% of carb target. Combined Grain + Root ≤ Carb target. |
| 3 | Vitamin A | 5–10% of starting volume from Organ category, default chicken liver — but if a different liver (lamb, beef, duck) is picked it back-calculates the gram amount needed to hit AAFCO Vit A min | Hard rule: must stay within macro-target ranges. |
| 4 | Vitamin B-complex | ~2% of starting volume of Brewer's Yeast | Single suggestion, supplement-style. |
| 5 | Choline | Top 5 choline-dense ingredients ranked, with **Egg yolk (鸡蛋黄)** highlighted as default at 20–40 g. Broccoli is the second highlighted option. | If Vit A step already pushed choline over the AAFCO min, mark this step "already covered" but still let her add. |
| 6 | Vitamin E | Vegetable oil 10–30 g (the picker shows oils ranked by Vit E density so she can pick the most efficient one) | Closes both Vit E and topping up Fat. |
| 7 | Vitamin D | Often already covered by egg yolk; if not, suggest fatty ocean fish (salmon, sardine, mackerel) ranked by Vit D | Show "already covered" badge if AAFCO Vit D min is met. |
| 8 | Iron | Usually already covered by meat + liver; if not, suggest **duck liver** until met | Same auto-skip if covered. |
| 9 | Zinc | ~30 g shellfish (oyster, clam, mussel, crab) | Picker pre-filtered to Fish/Seafood ranked by Zn. |
| 10 | Calcium | ~6–7 g eggshell powder (DB row #159, label corrected) | Eggshell powder is the default; nutritionist can also pick bone meal or other Ca-rich items. |
| 11 | Phosphorus | Usually covered; if not, suggest **wheat germ** or other P-rich items | Auto-skip if covered. |
| 12 | Sodium | If unmet, add salt | Tiny amounts (typically <0.5 g). |

After the wizard the nutritionist is dropped into the Simple Composer view (§10) with the recipe pre-populated. She can freely add, remove, or adjust grams from there. The wizard never locks the recipe.

---

## 10. Workflow 2 — Simple Composer

Free-form ingredient picker + sticky tracker + AAFCO dashboard. When any AAFCO nutrient is below min, the dashboard shows an inline **"Suggest fix"** link next to the red badge. Clicking it opens a side panel listing the top 3 ingredients (or supplements) ranked by efficiency at closing that specific gap, with a one-click Add.

This workflow is also where every recipe lives after the wizard finishes, so they share the same UI.

---

## 11. Saving recipes

The nutritionist can save the current recipe at any time. Save modal fields:

| Field | Type | Default |
|---|---|---|
| Recipe name | text | "Untitled recipe — {date}" |
| Species | auto from Pet Profile | locked |
| Life stage | auto | locked |
| Body weight (kg) | auto | locked |
| Target Pet ID | text | from Pet Profile |
| Notes | textarea | empty |
| Status | dropdown | Draft · In review · Approved |

Database schema (high-level):

```
users                 (Manus OAuth)
recipes               id, owner_id, name, species, life_stage,
                      body_weight_kg, pet_id, notes, status,
                      created_at, updated_at
recipe_ingredients    recipe_id, ingredient_id, grams, sort_order
recipe_targets        recipe_id, protein_min%, protein_max%,
                      carb_min%, carb_max%, macro_mode,
                      starting_volume_g
ingredients           id, name_zh, name_en, name_th, category,
                      edible_pct, [30 nutrient columns]
```

A "My Recipes" page lists all the user's recipes with name, species, status, last modified, and a thumbnail of the pet profile. Click → opens the recipe in the composer.

---

## 12. PDF export

Every recipe can be exported as a PDF spec sheet. Layout:

1. **Header** — GUGA wordmark, recipe name, pet name + ID, species, life stage, body weight, date.
2. **Pet profile + targets** — DER, water need, target macro ranges.
3. **Ingredient table** — name (in the active UI language, Chinese name always shown as secondary), grams, % of recipe, kcal contributed.
4. **Macro summary** — P / F / C as both % DM and % ME, with green/yellow/red status.
5. **AAFCO compliance table** — every nutrient with Total, per kg DM, per 1000 kcal ME, AAFCO min/max, and status colour.
6. **Daily feeding instructions** — grams/day, calorie density, batch size if entered.
7. **Notes** — nutritionist's free text.
8. **Footer** — disclaimer, GUGA logo, date, signed-in user, version of the AAFCO standard used (2016).

PDF is generated server-side from a styled React component → printed to PDF, so the visual matches the UI exactly.

---

## 13. Data sources and traceability

Every nutrient comparison cites its source on hover (AAFCO 2016 Dog/Cat Profiles for the standard; Disk's verified Chinese DB for the food values; NRC 2006 / FEDIAF 2024 for DER and water formulas). This is important for the nutritionist when she is justifying a recipe to a client or vet.

---

## 14. Out of scope for v1 (recorded for later)

- Cat-essential extras (taurine, methionine, cystine, arachidonic acid, arginine) — flagged for v2 once a second data source is integrated.
- Custom ingredient creation by the nutritionist.
- Cost-per-batch tracking.
- Multi-user / sharing / vet-portal.
- Auto-balance button (Disk explicitly chose real-time delta only).
- Mobile-optimised PWA install — desktop-first for v1.

---

## 15. Build order

The plan tool's phases drive execution. In short: translate + categorize ingredient names → upgrade to web-db-user → build the calculator UI shell → Guided Wizard → Simple Composer → save/load/export → end-to-end QA → deliver.

---

**Sign-off needed.** If anything in §1–§13 should change, tell me now. Otherwise reply "approved" and I will start with Phase 4 (translation + categorization of all 238 ingredients into English and Thai, plus assigning each row to the right category).
