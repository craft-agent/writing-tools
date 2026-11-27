import type { TextDocument } from "../model"
import { compile, NOUN_CHAR, type Phrase } from "./phrases"

/** What a marker tells the reader: that the writer requires, only supposes, or insists. */
export type MarkerKind = "obligation" | "conjecture" | "emphasis"

/** The kinds in the order the report lists them, each with the rule that reports it. */
export const MARKER_KINDS: readonly { kind: MarkerKind; rule: string }[] = [
  { kind: "obligation", rule: "obligation_changed" },
  { kind: "conjecture", rule: "conjecture_changed" },
  { kind: "emphasis", rule: "emphasis_changed" },
]

/** One marker found in a sentence: its kind, the wording that matched, and where it is in the text. */
export type Marker = { kind: MarkerKind; surface: string; start: number; end: number }

/** A word that is part of another word: a kanji before it, as in `非常` and `正常` before `常に`. */
const AFTER_KANJI = "(?<!\\p{Script=Han})"

/**
 * The markers each kind counts, as the package's own lists of patterns. Each
 * pattern is bounded so it does not match inside an unrelated word: `必要` is
 * a marker only before `がある` or a copula (never in `必要な機能`), `べき`
 * not in `べき乗`, `はず` only before `だ` or `です` (never in `はずす`),
 * `らしい` only after a verb ending (never in `彼らしい`), `絶対` not in
 * `絶対値`, and `必ず` not in `必ずしも`, which says the opposite. Every entry
 * names a sample its pattern matches, which the tests hold the lists to.
 */
export const MARKER_PHRASES: Readonly<Record<MarkerKind, readonly Phrase[]>> = {
  obligation: [
    {
      pattern: "(?:なければ|なくては|ねば)(?:なら(?:ない|ず)|なりません|いけ(?:ない|ません))",
      sample: "確認しなければなりません",
    },
    { pattern: "ないといけ(?:ない|ません)", sample: "入力しないといけない" },
    { pattern: "べき(?![乗等])(?:である|です|だ)?", sample: "確認すべきです" },
    { pattern: "(?<!不)必要が(?:ある|あります)", sample: "確認する必要があります" },
    { pattern: "(?<!不)必要(?:です|だ|である)", sample: "確認が必要です" },
    { pattern: "必須(?!ではな|ではあり)", sample: "必須の項目です" },
  ],
  conjecture: [
    { pattern: "(?:でしょ|だろ|であろ)う", sample: "雨が降るでしょう" },
    { pattern: "か(?:もしれ|も知れ)(?:ない|ません)", sample: "遅れるかもしれません" },
    { pattern: "と(?:思われ|考えられ)", sample: "原因はこれだと考えられる" },
    { pattern: "と思(?:います|う)", sample: "問題ないと思います" },
    { pattern: "はず(?:だ|です|である|が(?:ない|ありません))", sample: "届くはずです" },
    { pattern: "(?:おそらく|恐らく|たぶん|多分(?![にのな野]))", sample: "おそらく誤りです" },
    { pattern: "(?<=[うくぐすつぬぶむる]|(?<!あ)た|ない)らしい(?![くさ])", sample: "明日は雨が降るらしい" },
    { pattern: "よう(?:だ|です|である|だった|でした(?!ら))", sample: "届いたようです" },
    { pattern: "可能性[がもは](?:ある|あります|高い|低い)", sample: "遅れる可能性があります" },
  ],
  emphasis: [
    { pattern: "(?:必ず|かならず)(?!しも)", sample: "必ず保存してください" },
    { pattern: `絶対(?!${NOUN_CHAR}|ー)(?:に)?`, sample: "絶対に削除しない" },
    { pattern: `${AFTER_KANJI}(?:常に|つねに)`, sample: "常に最新です" },
    { pattern: `${AFTER_KANJI}決して`, sample: "決して忘れない" },
    { pattern: "まさに", sample: "まさに最適です" },
    { pattern: "(?<![どそこ])こそ(?![こあ])", sample: "今こそ始める" },
    { pattern: "非常に", sample: "非常に重要です" },
    { pattern: "(?:きわめて|極めて)(?![いきお、。，．])", sample: "極めて重要です" },
    { pattern: "(?<!不)確実に", sample: "確実に届きます" },
    { pattern: "(?:明らか|あきらか)に(?![すしなさ])", sample: "明らかに誤りです" },
  ],
}

/** The patterns of every kind, compiled once. */
const COMPILED = MARKER_KINDS.map(({ kind }) => ({
  kind,
  patterns: MARKER_PHRASES[kind].map(({ pattern }) => compile(pattern)),
}))

/** A sentence read without its whitespace, so a marker wrapped over a line break still matches: its text, with each masked unit kept as the mask character, and where each character is in the text. */
function compact(doc: TextDocument, start: number, end: number): { text: string; offsets: number[] } {
  const offsets: number[] = []
  let text = ""
  for (let at = start; at < end; at++) {
    if (/\s/.test(doc.masked[at])) continue
    offsets.push(at)
    text += doc.masked[at]
  }
  return { text, offsets }
}

/**
 * The markers in the sentence that spans `[start, end)`, in order of position.
 * A masked unit (inline code, a URL) is never read and never joins the words
 * around it; where two patterns of one kind match overlapping text, the one
 * that starts first, then the longer, counts alone.
 */
export function markersOf(doc: TextDocument, start: number, end: number): Marker[] {
  const { text, offsets } = compact(doc, start, end)
  const found = COMPILED.flatMap(({ kind, patterns }) => {
    const hits = patterns.flatMap((pattern) =>
      [...text.matchAll(pattern)].map((match) => ({ at: match.index, length: match[0].length })),
    )
    hits.sort((a, b) => a.at - b.at || b.length - a.length)
    let reached = 0
    return hits.flatMap(({ at, length }) => {
      if (at < reached) return []
      reached = at + length
      return [{ kind, surface: text.slice(at, at + length), start: offsets[at], end: offsets[at + length - 1] + 1 }]
    })
  })
  return found.sort((a, b) => a.start - b.start)
}
