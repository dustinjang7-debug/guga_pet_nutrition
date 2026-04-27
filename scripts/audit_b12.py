"""Quick audit of B12 column using line-by-line scan.

USDA reference values (μg per 100g):
- Chicken liver:  16.6
- Beef liver:     59.3
- Lamb liver:     90.1
- Duck liver:     54.0
- Pork liver:     26.0
- Egg yolk:        1.95
- Whole egg:       0.89
- Raw oyster:     16.0
- Sardine:         8.94
- Mackerel:       19.0
- Salmon:          3.18
- Tuna:            2.55
- Beef:            1.4
- Pork:            0.6
- Chicken thigh:   0.4
- Chicken breast:  0.34
- Milk (cow):      0.45
- Cheese (parmesan): 1.4
- Brewer's yeast:  0.0 (yeast contains very little unless fortified)
- Nutritional yeast (fortified): 1.7-25 depending on brand
"""
import re
from pathlib import Path

src = Path("/home/ubuntu/guga_pet_nutrition/shared/ingredients.ts").read_text()

# Walk lines, track current ingredient name, capture B12 value
records = []  # list of (name, b12, category)
cur_name = None
cur_cat = None
cur_b12 = None
for line in src.split("\n"):
    m = re.match(r'\s*"name_en":\s*"([^"]+)"', line)
    if m:
        # save previous
        if cur_name is not None:
            records.append((cur_name, cur_b12 if cur_b12 is not None else 0.0, cur_cat or "?"))
        cur_name = m.group(1)
        cur_b12 = None
        cur_cat = None
        continue
    m = re.match(r'\s*"category":\s*"([^"]+)"', line)
    if m:
        cur_cat = m.group(1)
        continue
    m = re.match(r'\s*"vit_b12_ug":\s*([0-9.]+)', line)
    if m:
        cur_b12 = float(m.group(1))
# flush last
if cur_name is not None:
    records.append((cur_name, cur_b12 if cur_b12 is not None else 0.0, cur_cat or "?"))

records.sort(key=lambda x: -x[1])
print(f"=== Top 20 B12 values (μg/100g) — total {len(records)} ingredients ===")
for n, v, c in records[:20]:
    print(f"  {v:9.3f}  [{c}] {n}")

print("\n=== Liver/Organ rows ===")
expected = {
    "Chicken liver": 16.6, "Beef liver": 59.3, "Pork liver": 26.0,
    "Lamb liver": 90.1, "Duck liver": 54.0,
}
for n, v, c in records:
    if "iver" in n or c.lower() == "organ":
        flag = ""
        for ref, exp in expected.items():
            if ref.lower() in n.lower() and abs(v - exp) > exp * 0.5:
                flag = f"  <-- expected ~{exp}"
                break
        print(f"  {v:9.3f}  [{c}] {n}{flag}")

print("\n=== Egg / Seafood rows ===")
egg_check = {
    "egg yolk": 1.95, "raw oyster": 16.0, "sardine": 8.94, "salmon": 3.18,
    "mackerel": 19.0, "whole egg": 0.89, "tuna": 2.55,
}
for n, v, c in records:
    nl = n.lower()
    if "egg" in nl or c.lower() in ("seafood", "fish"):
        flag = ""
        for ref, exp in egg_check.items():
            if ref in nl and abs(v - exp) > exp * 0.5:
                flag = f"  <-- expected ~{exp}"
                break
        print(f"  {v:9.3f}  [{c}] {n}{flag}")

non_zero = [v for _, v, _ in records if v > 0]
print(f"\n=== Distribution: {len(records)} ingredients, B12>0: {len(non_zero)}, =0: {len(records)-len(non_zero)} ===")
if non_zero:
    print(f"Max: {max(non_zero):.2f}  Mean: {sum(non_zero)/len(non_zero):.2f}  Median: {sorted(non_zero)[len(non_zero)//2]:.4f}")
