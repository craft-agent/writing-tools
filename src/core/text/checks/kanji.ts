import type { Sentence, TextDocument } from "../model"
import type { RawFinding } from "../rules"

/**
 * A run of kanji: characters of the Han script, which holds the ideographs of
 * every extension, 々 and 〇, and 〆, which the script leaves out. A masked
 * character, a space or any other character ends the run.
 */
const KANJI_RUN = /[\p{Script=Han}\u3006]+/gu

/**
 * The kanji numerals, the package's own list. They stay part of a run but do
 * not count toward its length, so a date or an amount is not a long run.
 */
const KANJI_NUMERALS: ReadonlySet<string> = new Set([..."〇一二三四五六七八九十百千万億兆"])

/**
 * The `kanji_run` findings: each run with more than `limit` kanji that are
 * not numerals, counted in code points, one per run and spanning the whole run.
 */
export function findKanjiRun(doc: TextDocument, sentences: readonly Sentence[], limit: number): RawFinding[] {
  return sentences.flatMap(({ start, end }) =>
    [...doc.masked.slice(start, end).matchAll(KANJI_RUN)].flatMap(({ 0: run, index }) => {
      const length = [...run].filter((char) => !KANJI_NUMERALS.has(char)).length
      if (length <= limit) return []
      return [
        {
          rule: "kanji_run",
          start: start + index,
          end: start + index + run.length,
          reason: `${length} kanji in a row, past ${limit}; splitting the compound or writing part of it in hiragana may read lighter`,
        },
      ]
    }),
  )
}
