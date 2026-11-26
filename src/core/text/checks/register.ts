import { MASK_CHAR, type LineKind, type Sentence, type TextDocument } from "../model"
import type { Occurrence } from "./convention"

/** The value of `register` a sentence ending writes. */
export type Register = "polite" | "plain"

/** A sentence's ending: its register, and where the matched ending starts in the text that was classified. */
export type Ending = { register: Register; index: number }

/**
 * The endings of each register, as the package's own table. A word ending
 * may take one of the particles that follow it; a final character ends a
 * plain sentence on its own. Polite is tried first, since `でした` and
 * `ください` also end in a plain final character.
 */
const ENDINGS = [
  {
    register: "polite",
    words: ["です", "ます", "ません", "ました", "でした", "ましょう", "ませんでした", "ください", "下さい", "でしょう"],
    particles: ["か", "ね", "よ", "よね"],
    finals: "",
  },
  {
    register: "plain",
    words: ["だ", "である", "だった", "であった", "ではない", "でない", "だろう"],
    particles: ["か", "ね", "よ"],
    finals: "るうくすつぬぶむぐたい",
  },
] as const satisfies readonly {
  register: Register
  words: readonly string[]
  particles: readonly string[]
  finals: string
}[]

const PATTERNS = ENDINGS.map(({ register, words, particles, finals }) => ({
  register,
  pattern: new RegExp(`(?:${words.join("|")})(?:${particles.join("|")})?$${finals === "" ? "" : `|[${finals}]$`}`),
}))

/** What follows a sentence's wording and is no part of it: emphasis, closing brackets, spaces, and a note in parentheses after other text. */
const TRAILING = /(?:[*_」』）)\]\s]|(?<!^)[（(][^（）()]*[）)])$/

/** The kinds of block whose sentences are counted. */
const COUNTED_KINDS: ReadonlySet<LineKind> = new Set(["prose", "list"])

/** The text with what trails the wording taken off, again and again until nothing more goes. */
function stripTrailing(text: string): string {
  const stripped = text.replace(TRAILING, "")
  return stripped === text ? text : stripTrailing(stripped)
}

/**
 * The register a sentence's wording ends in, from the text before its
 * terminator, or `undefined` when it ends in neither (a noun, a particle).
 * `index` is where the matched ending starts in `body`.
 */
export function classifyEnding(body: string): Ending | undefined {
  const text = stripTrailing(body)
  for (const { register, pattern } of PATTERNS) {
    const match = pattern.exec(text)
    if (match !== null) return { register, index: match.index }
  }
  return undefined
}

/** The sentence's characters without the masked units, and where each one is in the text. */
function visible(masked: string, { start, end }: Sentence): { text: string; offsets: number[] } {
  const offsets: number[] = []
  for (let at = start; at < end; at++) if (masked[at] !== MASK_CHAR) offsets.push(at)
  return { text: offsets.map((at) => masked[at]).join(""), offsets }
}

/**
 * The register of every sentence of body text and list items that ends in a
 * terminator, spanning the ending through the terminator. A sentence without
 * a terminator, in a heading or a quotation, or with another ending, is not
 * counted.
 */
export function findRegister(doc: TextDocument): Occurrence[] {
  return doc.sentences.flatMap((sentence) => {
    if (!COUNTED_KINDS.has(sentence.kind) || sentence.terminator === null) return []
    const { text, offsets } = visible(doc.masked, sentence)
    const terminatorAt = text.lastIndexOf(sentence.terminator)
    const ending = classifyEnding(text.slice(0, terminatorAt))
    if (ending === undefined) return []
    return [{ value: ending.register, start: offsets[ending.index], end: offsets[terminatorAt] + 1 }]
  })
}
