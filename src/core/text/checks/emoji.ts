import type { RawFinding } from "../rules"
import type { LineView } from "./lines"
import { compile, matchesIn } from "./phrases"

/**
 * A run of emoji: characters shown as emoji by default (`Emoji_Presentation`),
 * or pictographs that the variation selector U+FE0F turns into emoji, each
 * with the skin tone or zero-width joiner that goes with it. A symbol shown as
 * text by default (`↔` `✔` `♥`) is no emoji without the selector. `©` `®` and
 * `™` are pictographs by the standard and text in a document; a digit, `#` or
 * `*` is no pictograph, so a keycap sequence is not a run either.
 */
const EMOJI_RUN = compile(
  "(?:(?:\\p{Emoji_Presentation}|(?![©®™])\\p{Extended_Pictographic}\\uFE0F)[\\uFE0F\\u200D\\u{1F3FB}-\\u{1F3FF}]*)+",
)

/** The `emoji` findings: each run of consecutive emoji in the readable lines, spanning the run. */
export function findEmoji(lines: readonly LineView[]): RawFinding[] {
  return matchesIn(lines, EMOJI_RUN).map(({ start, end, match }) => ({
    rule: "emoji",
    start,
    end,
    reason: `an emoji sets a tone; "${match[0]}" may be left out`,
  }))
}
