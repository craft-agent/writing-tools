import type { TextDocument } from "../model"
import { CODE_CHAR, DIGITS } from "./chars"
import { readableLines } from "./lines"
import { BIG_UNITS, KANJI_DIGITS, SMALL_UNITS, valueOf } from "./numerals"
import type { Use } from "./uses"

/**
 * The patterns of the numbers a revision keeps or loses, as the package's own
 * data. A number is a run of digits of either width, with comma grouping and a
 * decimal part, or a run of kanji numerals; a kanji numeral is a number only
 * before a counter, so 一般, 統一 and 一緒 are words, not numbers.
 */

/** Counters and units that make a run of kanji numerals a number, the longer first. A `部` is left out: 一部 is a word. */
const COUNTERS = [
  "か月",
  "ヶ月",
  "カ月",
  "ヵ月",
  "ケ月",
  "か国",
  "ヶ国",
  "カ国",
  "世紀",
  "円",
  "年",
  "月",
  "日",
  "時",
  "分",
  "秒",
  "人",
  "件",
  "個",
  "回",
  "本",
  "枚",
  "台",
  "倍",
  "割",
  "歳",
  "%",
  "％",
  "度",
  "点",
  "位",
  "番",
  "階",
  "冊",
  "社",
  "名",
  "週",
  "つ",
  "号",
  "章",
  "条",
  "項",
  "軒",
  "匹",
  "頭",
] as const

/** Words that start like a number with a counter and are not one: 一番 ("most") and 十分 ("enough"), but not 十分間 ("ten minutes"). */
const NOT_NUMBERS = /十分(?!間)|一番/y

/** Kanji that make a word of the 一 after them (同一, 唯一, 単一, 均一, 統一), so the 一 is no numeral. */
const WORD_BEFORE_ONE = "同唯単均統"

/** What a Latin word's letters, an inline code unit or a digit, or a kanji numeral, may be before a run: a run never starts inside a word or another number. */
const KANJI = `${KANJI_DIGITS}${SMALL_UNITS}${BIG_UNITS}`
const NOT_BEFORE = `[A-Za-z_Ａ-Ｚａ-ｚ＿${CODE_CHAR}${DIGITS}${KANJI}]`

/** Digits of either width, in comma groups of three if grouped, with an optional decimal part. */
const ARABIC = `[${DIGITS}]+(?:[,，][${DIGITS}]{3})*(?:[.．][${DIGITS}]+)?`

/** A run of digits and kanji numerals, not part of a Latin word or an identifier such as `A4` or `HTTP2`. */
const RUN = new RegExp(
  `(?<!${NOT_BEFORE})(?:${ARABIC}|(?<![${WORD_BEFORE_ONE}])[${KANJI}])(?:${ARABIC}|[${KANJI}])*`,
  "gu",
)

const HAS_DIGIT = new RegExp(`[${DIGITS}]`)
const HAS_KANJI = new RegExp(`[${KANJI}]`)

/** A kanji numeral is read only if it has a digit of its own, or starts with a multiplier that stands for one (千円, 百回). */
const HAS_VALUE = new RegExp(`[${KANJI_DIGITS}]|^[${SMALL_UNITS}]`)

const COUNTER = new RegExp(COUNTERS.join("|"), "y")

/** Whether a run is a number: digits, with or without 万, 億 and the like, always are; kanji numerals alone only before a counter. */
function isNumber(run: string, line: string, start: number): boolean {
  if (!HAS_KANJI.test(run) || HAS_DIGIT.test(run)) return true
  if (!HAS_VALUE.test(run)) return false
  NOT_NUMBERS.lastIndex = start
  if (NOT_NUMBERS.test(line)) return false
  COUNTER.lastIndex = start + run.length
  return COUNTER.test(line)
}

/**
 * Every number of the prose, list items, headings and table rows, in order of
 * position, keyed by its value (see {@link valueOf}), so `1,000`, `１０００`
 * and `千` before 円 are one number. Digits that are part of a Latin word
 * (`HTTP2`, `A4`) are no numbers. Quotations and masked text are never read.
 * A date or a time is the numbers it is written with: 2026年11月27日 is 2026,
 * 11 and 27.
 */
export function numbersOf(doc: TextDocument): Use[] {
  return readableLines(doc).flatMap(({ start, text }) =>
    [...text.matchAll(RUN)]
      .filter((match) => isNumber(match[0], text, match.index))
      .map((match) => ({
        key: valueOf(match[0]),
        form: match[0],
        start: start + match.index,
        end: start + match.index + match[0].length,
      })),
  )
}
