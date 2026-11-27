import type { TextDocument } from "../model"
import { OPENING_BRACKETS } from "./chars"
import { followsMasked } from "./lead"
import { NOUN_CHAR } from "./phrases"

/** A word that may open a sentence, and what must follow it for it to be the opening and not the start of another word. */
type LeadWord = { word: string; before?: string }

/**
 * Where a short word ends and the sentence goes on: a comma, a particle, a
 * kanji, a katakana word, a Latin word, a digit, a masked unit, or the end of
 * the sentence. Another kana right after it makes a different word, as in
 * `それぞれ` and `まずい`.
 */
const BOUNDARY = `(?=[、，,はがをにでともへのやか]|${NOUN_CHAR}|[A-Za-z0-9\\u0000]|$)`

/** A comma right after the word: it is a lead only there, as `では、` and not `では` in the middle of a verb phrase. */
const COMMA = "(?=[、，,])"

/** Where `こう` and `そう` open a sentence: a comma or a kanji or katakana word, and no particle, which would make `そうです` a lead. */
const WORD_BOUNDARY = `(?=[、，,]|${NOUN_CHAR})`

/** A word whose opening needs a {@link BOUNDARY}, unless the pattern `unless` holds. */
function bounded(word: string, unless = ""): LeadWord {
  return { word, before: `${unless}${BOUNDARY}` }
}

/**
 * The connectives that open a sentence, as the package's own list. One that
 * is also the start of other words needs what follows it spelt out (`ただ` is
 * no lead before `の`, `また` none before `が`); a word that has no other
 * reading opens a sentence whatever follows. `または` is a lead of its own, so
 * `また` is never read in it.
 */
export const CONNECTIVES: readonly LeadWord[] = [
  ...[
    "しかしながら",
    "しかし",
    "ところが",
    "ところで",
    "そして",
    "そうして",
    "こうして",
    "それから",
    "それに",
    "それでも",
    "それでは",
    "それで",
    "それとも",
    "だから",
    "ですから",
    "したがって",
    "そのため",
    "このため",
    "そのうえ",
    "その結果",
    "そこで",
    "このように",
    "そのように",
    "さらに",
    "なぜなら",
    "つまり",
    "すなわち",
    "他方",
    "次に",
    "最初に",
    "最後に",
    "ただし",
    "なおかつ",
    "しかも",
    "ですが",
    "だが",
    "けれども",
    "けれど",
    "だけど",
    "とはいえ",
    "加えて",
    "逆に",
    "反対に",
    "同様に",
    "要するに",
    "結局",
    "例えば",
    "たとえば",
    "ちなみに",
    "あるいは",
    "もしくは",
    "または",
    "よって",
    "ゆえに",
    "さて",
  ].map((word) => ({ word })),
  { word: "また", before: "(?![ぎがのも])" },
  { word: "一方", before: "(?=[、，,で])" },
  { word: "もっとも", before: COMMA },
  { word: "では", before: COMMA },
  { word: "でも", before: COMMA },
  bounded("ただ", "(?!の)"),
  bounded("なお", "(?![のも])"),
  bounded("まず"),
]

/**
 * The demonstratives that open a sentence, as the package's own list: a
 * pronoun, an adnominal or an adverb that points back to what was said. A
 * short one is a lead only at a {@link BOUNDARY}, so `それぞれ` is none;
 * `その` is none in `その他`.
 */
export const DEMONSTRATIVES: readonly LeadWord[] = [
  ...[
    "これら",
    "それら",
    "あれら",
    "こうした",
    "そうした",
    "こういった",
    "そういった",
    "このような",
    "そのような",
    "こんな",
    "そんな",
    "あんな",
  ].map((word) => ({ word })),
  ...["これ", "それ", "あれ", "この", "あの", "ここ", "そこ"].map((word) => bounded(word)),
  bounded("その", "(?!他)"),
  { word: "こう", before: WORD_BOUNDARY },
  { word: "そう", before: WORD_BOUNDARY },
]

/** Opens the pattern the leads are read with: brackets before the first word are no part of the opening. */
const OPENERS = `^[${OPENING_BRACKETS}(\\[“"‘']*`

/** Every lead word, the longest first so that `しかしながら` is read before `しかし` and `そのため` before `その`. */
const LEADS = new RegExp(
  `${OPENERS}(${[...CONNECTIVES, ...DEMONSTRATIVES]
    .sort((a, b) => b.word.length - a.word.length)
    .map(({ word, before = "" }) => word + before)
    .join("|")})`,
  "u",
)

/** A lead found in a sentence: the word, and where it is in the text. */
export type Lead = { word: string; start: number; end: number }

/**
 * The connective or demonstrative a sentence opens with, or `undefined`: the
 * longest word of the lists at the start of the sentence that spans
 * `[start, end)`, after any opening brackets and before a boundary the word
 * needs. Masked text is never read, so a sentence that opens with a masked
 * unit has no lead.
 */
export function leadOf(doc: TextDocument, start: number, end: number): Lead | undefined {
  if (followsMasked(doc, start)) return undefined
  const match = LEADS.exec(doc.masked.slice(start, end))
  if (match === null) return undefined
  const from = start + match[0].length - match[1].length
  return { word: match[1], start: from, end: from + match[1].length }
}
