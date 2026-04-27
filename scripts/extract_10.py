"""Extract current DB values for 10 high-usage ingredients."""
import re
from pathlib import Path

src = Path("/home/ubuntu/guga_pet_nutrition/shared/ingredients.ts").read_text()

TARGETS = [
    "Chicken breast",
    "Chicken liver",
    "Beef liver",
    "Raw oyster",
    "Egg yolk",
    "Salmon",
    "Sardine",
    "Beef, lean",
    "Pork, lean",
    "Sweet potato, red flesh",
    "Rice, white",
]

# Walk objects (`{ ... },`) — collect each as a dict of key→value
objs = []
cur: dict[str, str] = {}
brace_depth = 0
buf = ""

for ch in src:
    if ch == "{":
        if brace_depth == 0:
            buf = ""
            cur = {}
        brace_depth += 1
        buf += ch
    elif ch == "}":
        brace_depth -= 1
        buf += ch
        if brace_depth == 0:
            # parse buf for key:value
            for m in re.finditer(r'"(\w+)":\s*("[^"]*"|[\d.eE+-]+)', buf):
                cur[m.group(1)] = m.group(2)
            if cur.get("name_en") and cur["name_en"].strip('"') in TARGETS:
                objs.append(cur.copy())
            cur = {}
    else:
        if brace_depth > 0:
            buf += ch

# Print compactly
keys_to_show = [
    "name_en", "category", "water_g", "energy_kcal", "protein_g", "fat_g",
    "carbohydrate_g", "calcium_mg", "phosphorus_mg", "sodium_mg",
    "potassium_mg", "iron_mg", "zinc_mg", "selenium_ug",
    "vit_a_re_ug", "vit_d_ug", "vit_e_mg", "vit_b12_ug",
    "vit_b1_mg", "vit_b2_mg", "niacin_b3_mg", "vit_b6_mg",
    "folate_mg", "choline_mg",
]

print(f"Found {len(objs)} matches\n")
for o in objs:
    print(f"--- {o.get('name_en','?').strip(chr(34))} (id {o.get('id','?')}) ---")
    for k in keys_to_show:
        v = o.get(k)
        if v is None: continue
        print(f"  {k:20s} = {v}")
    print()
