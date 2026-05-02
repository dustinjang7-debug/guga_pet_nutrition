/**
 * Percentage-based recipe rebalancing.
 *
 * The Current Recipe panel in the Simple Composer expresses every ingredient
 * as a % of the recipe's total weight. When the user edits one row, the total
 * weight (grams) must be preserved — only the distribution changes.
 *
 * Rules:
 *   • Total grams (T) is constant across the rebalance.
 *   • The edited row gets the new percentage.
 *   • Any "locked" rows (excluding the edited row) hold their current grams.
 *   • All remaining unlocked rows absorb the delta pro-rata, weighted by their
 *     current grams.
 *
 * Edge cases handled:
 *   • If the edited %  > 100 - sum(locked%), we clamp it so locked rows
 *     keep their absolute grams. The edited row receives at most the slack.
 *   • If unlocked rows sum to 0 grams, they cannot absorb anything. We
 *     fall back to giving all the slack to the edited row.
 *   • A negative target % is clamped to 0.
 */

export interface RebalanceItem {
  ingredientId: number;
  grams: number;
  locked?: boolean;
}

export function totalGrams(items: { grams: number }[]): number {
  return items.reduce((s, i) => s + i.grams, 0);
}

export function gramsToPct(grams: number, total: number): number {
  return total > 0 ? (grams / total) * 100 : 0;
}

/**
 * Recompute item grams after the user edits one row's percentage.
 *
 * @param items        Current items (grams + optional `locked` flag)
 * @param editedId     The ingredientId of the row whose % was edited
 * @param newPct       The new percentage (0–100) the user typed
 * @returns            New items array with grams updated; total grams unchanged
 */
export function rebalanceByPct(
  items: RebalanceItem[],
  editedId: number,
  newPct: number,
): RebalanceItem[] {
  const T = totalGrams(items);
  if (T <= 0 || items.length === 0) return items;

  const edited = items.find(i => i.ingredientId === editedId);
  if (!edited) return items;

  const lockedOther = items.filter(
    i => i.ingredientId !== editedId && i.locked === true,
  );
  const unlockedOther = items.filter(
    i => i.ingredientId !== editedId && i.locked !== true,
  );

  const lockedGrams = lockedOther.reduce((s, i) => s + i.grams, 0);
  const slack = T - lockedGrams; // grams available to share between edited + unlocked

  if (slack <= 0) {
    // No room to move — keep current state
    return items;
  }

  // Target grams for the edited row (clamped 0..slack)
  let editedTargetG = (Math.max(0, newPct) / 100) * T;
  if (editedTargetG > slack) editedTargetG = slack;

  const remainingForUnlocked = slack - editedTargetG;
  const unlockedCurrentG = unlockedOther.reduce((s, i) => s + i.grams, 0);

  return items.map(i => {
    if (i.ingredientId === editedId) {
      return { ...i, grams: round1(editedTargetG) };
    }
    if (i.locked) return { ...i, grams: round1(i.grams) };
    if (unlockedCurrentG > 0) {
      const share = i.grams / unlockedCurrentG;
      return { ...i, grams: round1(remainingForUnlocked * share) };
    }
    // Fallback: equal split
    const equal = unlockedOther.length > 0 ? remainingForUnlocked / unlockedOther.length : 0;
    return { ...i, grams: round1(equal) };
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
