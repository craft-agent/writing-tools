/**
 * The character classes of the notation rules, as regular expression sources
 * to be placed inside the rules' own patterns. They are the package's own
 * data; the Unicode blocks they name are the ones the standard defines.
 */

/** Stands in a line's view for each unit of an inline code span, which reads as a Latin word. */
export const CODE_CHAR = "\u0001"

/** Stands in a line's view for each unit of a link target, which Markdown does not show beside the link text. */
export const LINK_CHAR = "\u0002"

/** Hiragana, katakana with ー but not ・, ideographs with extension A, and 々 and 〆. */
const JAPANESE_RANGES =
  "\\u3041-\\u3096\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3005\\u3006\\u3400-\\u4DBF\\u4E00-\\u9FFF"

/** One Japanese character. */
export const JAPANESE = `[${JAPANESE_RANGES}]`

/** A pattern that tests whether a text, or one character, holds a Japanese character. */
export const HAS_JAPANESE = new RegExp(JAPANESE)

/** One letter of a Latin word, or a unit of inline code. */
export const LATIN = `[A-Za-z${CODE_CHAR}]`

/** What sits unseen between two characters: Markdown emphasis, link brackets and a link's target. */
export const TRANSPARENT = `[*_\\[\\]${LINK_CHAR}]`

/** A pattern that tests one character for {@link TRANSPARENT}. */
export const IS_TRANSPARENT = new RegExp(TRANSPARENT)

/** The spaces the rules count: the ASCII space and the ideographic space. */
export const SPACE = "[ \\u3000]"

/** A pattern that tests one character for {@link SPACE}. */
export const IS_SPACE = new RegExp(SPACE)

/** A run of fullwidth Latin letters and digits. */
export const FULLWIDTH_ALNUM_RUN = /[０-９Ａ-Ｚａ-ｚ]+/g

/** A run of ASCII letters and digits. */
export const HALFWIDTH_ALNUM_RUN = /[0-9A-Za-z]+/g

/** A run of halfwidth katakana and their marks, with the halfwidth punctuation among them. */
export const HALFWIDTH_KATAKANA_RUN = /[\uFF61-\uFF9F]+/g

/** The units a numeral takes in `unit_spacing`; the package's own list. */
export const UNITS = [
  "B",
  "KB",
  "MB",
  "GB",
  "TB",
  "PB",
  "KiB",
  "MiB",
  "GiB",
  "TiB",
  "bps",
  "Kbps",
  "Mbps",
  "Gbps",
  "Hz",
  "kHz",
  "MHz",
  "GHz",
  "ms",
  "us",
  "µs",
  "μs",
  "ns",
  "px",
  "pt",
  "em",
  "rem",
  "dpi",
  "mm",
  "cm",
  "m",
  "km",
  "mg",
  "g",
  "kg",
  "mL",
  "L",
  "W",
  "kW",
  "V",
  "mAh",
] as const

/** The commas `punctuation` tells apart. */
export const COMMAS: readonly string[] = ["、", "，"]

/** The periods `punctuation` tells apart. */
export const PERIODS: readonly string[] = ["。", "．"]

/** Every mark of {@link COMMAS} and {@link PERIODS}. */
export const SENTENCE_MARKS: readonly string[] = [...COMMAS, ...PERIODS]

/** The brackets `space_inside_brackets` reads, opening and closing. */
export const OPENING_BRACKETS = "「『（【〔〈《"
export const CLOSING_BRACKETS = "」』）】〕〉》"

/** A digit, of either width. */
export const DIGIT = "[0-9０-９]"
