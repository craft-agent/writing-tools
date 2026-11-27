import type { Alignment, Side, Status } from "../align"
import { leadOf } from "../excerpt"

/** One use of a number or a name in a text: the key that makes its forms one value, the form as written, and its span in the text. */
export type Use = { key: string; form: string; start: number; end: number }

/** The use as a reason quotes it: its key in double quotes, with how it was written when that differs from the key. */
export function labelOf({ key, form }: Use): string {
  return key === form ? `"${key}"` : `"${key}" (written ${leadOf(form)})`
}

/** How much a use is to blame for a count that differs: one in a sentence with no pair most, one in a changed pair or outside every sentence next, one in an unchanged pair least. */
const BLAME: Readonly<Record<Status | "outside", number>> = { unpaired: 2, changed: 1, outside: 1, unchanged: 0 }

/**
 * The uses of `side` that the other text has no use for: for each key, as
 * many as it has more uses than `other`. A use that stands in a sentence the
 * other text did not keep or changed is the one left over, an unchanged
 * sentence last; among equals, the later one. A sentence that only moved
 * changes no count. In order of position.
 */
export function unmatchedUses(side: Side, uses: readonly Use[], other: readonly Use[], alignment: Alignment): Use[] {
  const held = new Map<string, number>()
  for (const { key } of other) held.set(key, (held.get(key) ?? 0) + 1)
  const byKey = new Map<string, Use[]>()
  for (const use of uses) {
    const group = byKey.get(use.key)
    if (group === undefined) byKey.set(use.key, [use])
    else group.push(use)
  }
  const left: Use[] = []
  for (const [key, group] of byKey) {
    const excess = group.length - (held.get(key) ?? 0)
    if (excess <= 0) continue
    const ranked = group
      .map((use, order) => ({ use, order, blame: BLAME[alignment.statusAt(side, use.start) ?? "outside"] }))
      .sort((a, b) => b.blame - a.blame || b.order - a.order)
    left.push(...ranked.slice(0, excess).map(({ use }) => use))
  }
  return left.sort((a, b) => a.start - b.start)
}
