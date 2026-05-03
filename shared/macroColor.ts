/**
 * Determine an ingredient's "dominant macro" by kcal contribution.
 *
 * Atwater factors: protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g.
 * The macro contributing the most kcal wins. Ties resolved fat > protein > carb
 * (fat-rich ingredients like oils are visually most salient).
 *
 * Returned classes are Tailwind utility strings so callers can drop them into
 * className without a wrapper. Palette is intentionally muted so the rows stay
 * legible against the panel background.
 */

export type MacroKey = "protein" | "fat" | "carb";

export const MACRO_COLORS: Record<MacroKey, { stripe: string; dot: string; label: string }> = {
  protein: { stripe: "bg-rose-400",   dot: "bg-rose-500",   label: "P" },
  fat:     { stripe: "bg-amber-400",  dot: "bg-amber-500",  label: "F" },
  carb:    { stripe: "bg-sky-400",    dot: "bg-sky-500",    label: "C" },
};

export function dominantMacro(ing: { protein_g: number; fat_g: number; carb_g: number }): MacroKey {
  const pKcal = ing.protein_g * 4;
  const fKcal = ing.fat_g * 9;
  const cKcal = ing.carb_g * 4;

  // Edge case: zero-macro ingredients (water, pure mineral powders) → carb
  // (visually neutral). Real "balancers" are categorised separately upstream.
  if (pKcal + fKcal + cKcal === 0) return "carb";

  if (fKcal >= pKcal && fKcal >= cKcal) return "fat";
  if (pKcal >= cKcal) return "protein";
  return "carb";
}
