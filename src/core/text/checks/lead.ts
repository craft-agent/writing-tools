import type { Token } from "../../engine/tokens"
import { MASK_CHAR, type LineKind, type TextDocument } from "../model"
import type { Genre, RawFinding } from "../rules"
import { terminatedSentences } from "./register"
import { LEAD_REPEAT } from "./thresholds"
import { sentenceTokens, type BlockTokens } from "./tokenized"

/** The kinds of block whose sentence openings are counted: body text. */
const LEAD_KINDS: ReadonlySet<LineKind> = new Set(["prose"])

/** The parts of speech of a token that is no word: punctuation, brackets and spaces. */
const SYMBOLS: ReadonlySet<string> = new Set(["補助記号", "空白"])

/** The words that open a sentence and are counted as its lead. */
const LEAD_WORDS = 2

/** A word of Latin letters, such as a product or an identifier: a text about it opens many sentences with it on purpose. */
const LATIN_WORD = /^[A-Za-z][A-Za-z0-9._-]*$/

const PROPER_NOUN = "固有名詞"

/** A space or a tab; a line break is not one, so a masked unit on the line before is not read as this sentence's opening. */
const INLINE_SPACE = /[^\S\r\n]/

/** The sentence's tokens without the symbols before the first word and after the last. */
function words(tokens: readonly Token[]): readonly Token[] {
  const isWord = ({ pos }: Token) => !SYMBOLS.has(pos[0])
  const first = tokens.findIndex(isWord)
  if (first === -1) return []
  let last = tokens.length - 1
  while (!isWord(tokens[last])) last--
  return tokens.slice(first, last + 1)
}

/** Whether a unit the checks do not read (inline code, a URL) lies in the text from `from` to `to`. */
function holdsMasked(doc: TextDocument, from: number, to: number): boolean {
  return doc.masked.slice(from, to).includes(MASK_CHAR)
}

/** Whether a masked unit ends just before `at` on its line, with only spaces between: a sentence's start skips masked units, so one that opens with code starts after it. */
function followsMasked(doc: TextDocument, at: number): boolean {
  let before = at - 1
  while (before >= 0 && INLINE_SPACE.test(doc.masked[before])) before--
  return before >= 0 && doc.masked[before] === MASK_CHAR
}

/**
 * The first words of a sentence: up to the first two, and fewer where a
 * masked unit stands between them. A sentence that opens with a masked unit
 * has none.
 */
function leadOf(doc: TextDocument, start: number, tokens: readonly Token[]): Token[] {
  const [first, ...rest] = words(tokens)
  if (first === undefined || followsMasked(doc, start) || holdsMasked(doc, start, first.start)) return []
  const lead = [first]
  for (const token of rest.slice(0, LEAD_WORDS - 1)) {
    if (holdsMasked(doc, lead[lead.length - 1].end, token.start)) break
    lead.push(token)
  }
  return lead
}

/** Whether the word is one a text repeats at the head of its sentences for a reason: a proper noun, or a Latin word. */
function isSubjectWord({ pos, surface }: Token): boolean {
  return pos[1] === PROPER_NOUN || LATIN_WORD.test(surface)
}

/**
 * The `repeated_lead` findings: the sentences of body text that open with the
 * same first two words (the first word alone for a sentence of one), when the
 * genre's number of them or more do, once per opening, spanning the opening of
 * the first. An opening whose first word is a proper noun or a Latin word is
 * left out, since a text about one thing names it again and again.
 */
export function findRepeatedLead(doc: TextDocument, tokens: BlockTokens, genre: Genre): RawFinding[] {
  const sentences = terminatedSentences(doc, LEAD_KINDS).map(({ sentence }) => sentence)
  const openings = new Map<string, { lead: Token[]; count: number }>()
  for (const { sentence, tokens: inside } of sentenceTokens(doc, tokens, sentences)) {
    const lead = leadOf(doc, sentence.start, inside)
    if (lead.length === 0) continue
    const key = lead.map(({ surface }) => surface).join("")
    const opening = openings.get(key)
    if (opening === undefined) openings.set(key, { lead, count: 1 })
    else opening.count++
  }
  const limit = LEAD_REPEAT[genre]
  return [...openings]
    .filter(([, { lead, count }]) => count >= limit && !isSubjectWord(lead[0]))
    .map(([key, { lead, count }]) => ({
      rule: "repeated_lead",
      start: lead[0].start,
      end: lead[lead.length - 1].end,
      reason: `${count} sentences open with "${key}"; a different opening for some may read less monotonous`,
    }))
}
