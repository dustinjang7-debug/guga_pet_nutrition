# GUGA Pet Nutrition Calculator — Formulas & Life-Stage Factors

This document fixes the math, units, and reference values used by the calculator. Every value is sourced. Where the source PDF (Disk's reference: 宠物鲜粮配方设计工具软件 v2.9.0317) and the canonical NRC/FEDIAF differ, the PDF wins for life-stage factors (per Disk's instruction to use these); peer-reviewed sources are used for water intake and the AAFCO comparison.

---

## 1. Caloric intake

Energy follows the standard two-step approach used by NRC (2006) *Nutrient Requirements of Dogs and Cats* and FEDIAF (2024) *Nutritional Guidelines for Complete and Complementary Pet Food*.

**Step 1 — Resting Energy Requirement (RER), kcal/day**

$$\mathrm{RER} = 70 \times (\mathrm{BW_{kg}})^{0.75}$$

This allometric form is used by both NRC 2006 and FEDIAF 2024 for dogs and cats across all body sizes ([NRC 2006, Ch. 3](https://nap.nationalacademies.org/catalog/10668)). A linear approximation (`30 × BW + 70`) is sometimes used for adult dogs 2–45 kg but is less accurate at the extremes; the calculator uses the exponential form throughout.

**Step 2 — Daily Energy Requirement (DER), kcal/day**

$$\mathrm{DER} = \mathrm{RER} \times k$$

Where *k* is the **life-stage factor** taken directly from the user's reference PDF (page 2 of `宠物鲜粮配方设计工具软件2.9.0317.pdf`, section 参考值 | 生命阶段因子).

### Life-stage factors — Dogs (from PDF)

| Life stage (Chinese) | English | Factor *k* |
|---|---|---|
| 出生到4月龄幼犬 | Puppy, birth to 4 months | 3.0 |
| 4月龄到成犬之前 | Puppy, 4 months to adulthood | 2.0 |
| 未绝育成犬 | Adult, intact | 1.8 |
| 已绝育成犬 | Adult, neutered | 1.6 |
| 肥胖倾向成犬 | Adult, obese-prone | 1.4 |
| 需减肥成犬 | Adult, weight loss | 1.0 |
| 妊娠21日后的犬 | Pregnant (after day 21) | 3.0 |
| 哺乳期的犬 | Lactating | 4–8 (depends on litter size) |
| 轻度工作犬 | Light work | 2.0 |
| 中度工作犬 | Moderate work | 3.0 |
| 重度工作犬 | Heavy work | 4–8 |

### Life-stage factors — Cats (from PDF)

| Life stage (Chinese) | English | Factor *k* |
|---|---|---|
| 幼猫(成长期) | Kitten (growth) | 2.5 |
| 未绝育的成猫 | Adult, intact | 1.4 |
| 绝育的成猫 | Adult, neutered | 1.2 |
| 肥胖倾向的成猫 | Adult, obese-prone | 1.0 |
| 需减肥的成猫 | Adult, weight loss | 0.8–1.0 |
| 活动的猫 | Active cat | 1.6 |
| 妊娠期的猫 | Pregnant | 1.6–2.0 |
| 哺乳期的猫 | Lactating | 2–6 (depends on litter size) |

For ranges (lactating, weight loss, pregnant cat), the UI will expose a slider with the range and a sensible default (mid-range). The calculator surfaces *both* DER values when a range is in use so the nutritionist can pick.

---

## 2. Water intake

Daily water intake guidance comes from NRC 2006 and FEDIAF 2024. Two methods are commonly used; the calculator shows both side-by-side because hydration via fresh food is a core GUGA selling point.

**Method A — Body-weight rule (NRC 2006)**

For healthy adults at maintenance:

| Species | Formula | Source |
|---|---|---|
| Dog | `Water_mL/day ≈ 50–60 × BW_kg` | NRC 2006, Ch. 6 |
| Cat | `Water_mL/day ≈ 50–60 × BW_kg` | NRC 2006, Ch. 6 |

The calculator uses `60 mL/kg` as the default reference but exposes the 50–60 range visually.

**Method B — Energy-coupled rule (more accurate, NRC 2006)**

The most defensible method ties water need to caloric intake, because metabolic water demand scales with energy:

$$\mathrm{Water_{mL/day}} \approx 1.0 \times \mathrm{DER_{kcal/day}}$$

i.e. roughly **1 mL of water per kilocalorie of food energy** for both dogs and cats at maintenance ([NRC 2006, Ch. 6](https://nap.nationalacademies.org/catalog/10668); confirmed in [FEDIAF 2024 §6](https://europeanpetfood.org/self-regulation/nutritional-guidelines/)). This is the formula the calculator uses for the primary water-need number.

**Net water from food vs. drinking bowl**

Because GUGA recipes are wet (~60–80% moisture), a meaningful portion of the dog's/cat's daily water comes from food. The calculator computes:

```
water_in_food_mL/day  = recipe_water_g_per_serving (since 1 g water ≈ 1 mL)
water_from_bowl_mL/day = max(0, total_water_need - water_in_food)
```

This lets the nutritionist see exactly how much extra drinking water the pet still needs to consume each day.

**Modifiers (shown as informational notes, not auto-applied)**

The literature notes that water requirement increases substantially under heat stress, exercise, lactation, kidney disease, dry-food diets, and high-sodium diets ([Anderson 1982, *J Small Anim Pract*](https://onlinelibrary.wiley.com/doi/10.1111/j.1748-5827.1982.tb01761.x)). The UI shows these as "advisory notes", not multipliers.

---

## 3. Macronutrient targets

The user enters target percentages for **Protein / Fat / Carbohydrate** that the recipe should achieve. To match how AAFCO and most pet-food labels are read, all three are expressed as **% of dry matter (DM)** by default, with an optional toggle to view as **% of metabolisable energy (ME)**.

### Computation

For each macro:

```
total_g     = Σ over ingredients (used_g × nutrient_per_100g / 100)
DM_total_g  = Σ over ingredients (used_g × (100 – moisture%) / 100)
%DM         = total_g / DM_total_g × 100
```

The **% of ME** view uses the modified Atwater factors recommended by AAFCO and NRC for pet food (these are lower than human Atwater because pet diets contain more fibre and connective tissue):

| Macro | kcal per gram | Source |
|---|---|---|
| Protein | 3.5 | AAFCO Official Publication, modified Atwater |
| Fat | 8.5 | AAFCO Official Publication, modified Atwater |
| Carbohydrate (NFE) | 3.5 | AAFCO Official Publication, modified Atwater |

Then `%ME_protein = (protein_g × 3.5) / DER_kcal × 100`, etc. The three should sum to ~100% if the recipe is balanced.

### Validation rules

- **Sum check**: target P + F + C should equal 100%; if not, the UI flags the deviation but doesn't block.
- **AAFCO floor**: dog adult maintenance requires ≥18% protein DM and ≥5.5% fat DM; cat adult maintenance requires ≥26% protein DM and ≥9% fat DM (AAFCO 2016). If the user's target is below the AAFCO floor for the selected species/life stage, a warning appears.
- **Carbohydrate has no AAFCO minimum** for either species. Cats can survive without dietary carbs; dogs are flexible omnivores.

---

## 4. Daily feeding amount

Once DER and the recipe's energy density are known:

```
energy_density_kcal_per_g = total_kcal_in_recipe / total_grams_in_recipe
daily_feeding_g            = DER_kcal / energy_density_kcal_per_g
```

This is the same formula as the source PDF (page 1: 每日喂食量 = DER / 能量密度).

The UI also shows:
- Daily feeding in **grams**, **batch portions** (if the user defines batch size), and **days the batch will last**.
- A **calorie-per-gram readout** of the recipe so the nutritionist can target a specific energy density (e.g., 1.5–1.8 kcal/g for adult fresh dog food).

---

## 5. AAFCO comparison panel

For each nutrient, the calculator shows three figures and compares to AAFCO 2016 minimums and maximums:

1. **Total per recipe** (e.g., mg, μg, g)
2. **Per kg DM** (canonical AAFCO old basis)
3. **Per 1000 kcal ME** (canonical AAFCO modern basis — added so newer regulatory submissions are easy)

Color coding:
- 🟢 within range (≥ min and ≤ max)
- 🟡 within 10% of min (borderline)
- 🔴 below min or above max
- ⚪ no AAFCO requirement defined for this nutrient/species

The species toggle (Dog ↔ Cat) and life-stage toggle (Adult Maintenance ↔ Growth & Reproduction) re-runs the comparison instantly.

---

## 6. Sources

1. National Research Council. (2006). *Nutrient Requirements of Dogs and Cats*. National Academies Press. <https://nap.nationalacademies.org/catalog/10668/nutrient-requirements-of-dogs-and-cats>
2. FEDIAF. (2024). *Nutritional Guidelines for Complete and Complementary Pet Food for Cats and Dogs*. <https://europeanpetfood.org/self-regulation/nutritional-guidelines/>
3. AAFCO. (2016). *Dog and Cat Food Nutrient Profiles*, Official Publication.
4. Anderson, R.S. (1982). Water balance in the dog and cat. *Journal of Small Animal Practice*, 23(9), 588–598.
5. 景小俏宠物营养食品研究中心. *宠物鲜粮配方设计工具软件 v2.9.0317* (uploaded by Disk, April 2026).
