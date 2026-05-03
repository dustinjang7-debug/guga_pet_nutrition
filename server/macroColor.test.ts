import { describe, it, expect } from "vitest";
import { dominantMacro } from "../shared/macroColor";

describe("dominantMacro", () => {
  it("classifies chicken breast as protein", () => {
    expect(dominantMacro({ protein_g: 23.0, fat_g: 1.2, carb_g: 0.0 })).toBe("protein");
  });

  it("classifies pure oil as fat", () => {
    expect(dominantMacro({ protein_g: 0, fat_g: 99.9, carb_g: 0 })).toBe("fat");
  });

  it("classifies white rice as carb", () => {
    expect(dominantMacro({ protein_g: 7.4, fat_g: 0.8, carb_g: 77.2 })).toBe("carb");
  });

  it("classifies salmon (high fat fish) as fat when fat kcal > protein kcal", () => {
    // Salmon ~20g protein (80 kcal) vs ~13g fat (117 kcal) → fat
    expect(dominantMacro({ protein_g: 20, fat_g: 13, carb_g: 0 })).toBe("fat");
  });

  it("classifies lean salmon as protein when protein kcal > fat kcal", () => {
    // 24g protein (96 kcal) vs 5g fat (45 kcal) → protein
    expect(dominantMacro({ protein_g: 24, fat_g: 5, carb_g: 0 })).toBe("protein");
  });

  it("falls back to carb on zero-macro ingredients (e.g. water, salt)", () => {
    expect(dominantMacro({ protein_g: 0, fat_g: 0, carb_g: 0 })).toBe("carb");
  });

  it("breaks tie protein vs carb in favor of protein", () => {
    // 10g protein (40 kcal) vs 10g carb (40 kcal) → protein
    expect(dominantMacro({ protein_g: 10, fat_g: 0, carb_g: 10 })).toBe("protein");
  });

  it("breaks tie fat vs protein in favor of fat", () => {
    // 9g fat (81 kcal) vs 20.25g protein (81 kcal) → fat (fat is visually salient)
    expect(dominantMacro({ protein_g: 20.25, fat_g: 9, carb_g: 0 })).toBe("fat");
  });
});
