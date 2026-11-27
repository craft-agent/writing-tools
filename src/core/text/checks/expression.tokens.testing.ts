import type { PartOfSpeech, Token } from "../../engine/tokens"
import type { ToolOptions } from "../../tool"
import { resolveConventions } from "../conventions"
import { readDocument } from "../document"
import { MASK_CHAR, type TextDocument } from "../model"
import { DEFAULT_GENRE } from "../rules"
import { checkContext } from "../rules.testing"
import type { NotRun } from "../schemas"
import { selectRules } from "../selection"
import { expressionCheck } from "./expression"
import type { Given } from "./notation.testing"

/**
 * A stand-in for the engine in the tests of the rules that read tokens: a
 * lexicon of words, each written `surface/pos[/detail][=dictionary]`, cuts a
 * text greedily, longest word first, into the tokens the engine would give. A
 * word of the lexicon wins over a word of the same length the tests share.
 * A character the lexicon lacks is an error, so a test never reads a word
 * as something it did not say.
 */

/** The words every text of the tests uses. */
const BASE_WORDS = [
  "。/補助記号/句点",
  "、/補助記号/読点",
  "「/補助記号/括弧開",
  "」/補助記号/括弧閉",
  "は/助詞/係助詞",
  "も/助詞/係助詞",
  "が/助詞/格助詞",
  "を/助詞/格助詞",
  "の/助詞/格助詞",
  "に/助詞/格助詞",
  "と/助詞/格助詞",
  "で/助詞/格助詞",
  "です/助動詞",
  "し/動詞/非自立可能=する",
  "する/動詞/非自立可能",
]

/** The part of speech the engine gives a run of spaces, which is what the segment holds over a masked unit or a line break. */
const BLANK: PartOfSpeech = ["空白", "*", "*", "*", "*", "*"]

const SPACE = " "

/** The characters of a segment the engine reads as blank: masked units and line breaks. */
const BLANKED = new RegExp(`[${MASK_CHAR}\\r\\n]`, "g")

type Word = { surface: string; pos: PartOfSpeech; dictionary: string }

function parseWord(entry: string): Word {
  const [form, dictionary] = entry.split("=")
  const [surface, pos0, pos1 = "*"] = form.split("/")
  return { surface, pos: [pos0, pos1, "*", "*", "*", "*"], dictionary: dictionary ?? surface }
}

function tokenOf({ surface, pos, dictionary }: Word, start: number): Token {
  return { surface, start, end: start + surface.length, pos, normalized: dictionary, dictionary, reading: "" }
}

/** The tokens of one segment, their offsets moved by `offset`. */
function tokenize(segment: string, offset: number, words: readonly Word[]): Token[] {
  const tokens: Token[] = []
  for (let at = 0; at < segment.length;) {
    if (segment[at] === SPACE) {
      const end = segment.length - segment.slice(at).trimStart().length
      tokens.push(tokenOf({ surface: segment.slice(at, end), pos: BLANK, dictionary: SPACE }, offset + at))
      at = end
      continue
    }
    const word = words.find(({ surface }) => segment.startsWith(surface, at))
    if (word === undefined) throw new Error(`no word of the lexicon at "${segment.slice(at, at + 4)}"`)
    tokens.push(tokenOf(word, offset + at))
    at += word.surface.length
  }
  return tokens
}

/**
 * The tokens the engine would give a document, by the index of the block: its
 * paragraphs and list items, blanked as the engine reads them. `only` limits
 * them to those blocks, as if the engine had skipped the others.
 */
export function tokensOf(
  doc: TextDocument,
  lexicon: readonly string[],
  only?: readonly number[],
): Map<number, Token[]> {
  const words = [...lexicon, ...BASE_WORDS].map(parseWord).sort((a, b) => b.surface.length - a.surface.length)
  const tokens = new Map<number, Token[]>()
  for (const [index, block] of doc.blocks.entries()) {
    if (block.kind !== "prose" && block.kind !== "list") continue
    if (only !== undefined && !only.includes(index)) continue
    const segment = doc.masked.slice(block.start, block.end).replace(BLANKED, SPACE)
    tokens.set(index, tokenize(segment, block.start, words))
  }
  return tokens
}

/** The rules of the expression check that are on by default and read tokens. */
export const TOKEN_RULES = ["repeated_lead", "lexical_repetition"]

/** What a call without an engine lists as not run for `rules` of the expression check. */
export function unavailable(...rules: string[]): NotRun[] {
  return rules.map((rule) => ({ check: "expression", rule, reason: "morphology_unavailable" }))
}

/** What a finding of one rule shows: the text it spans, where that starts, and its reason. */
export type Hit = { text: string; start: number; reason: string }

/** Where the check's context is held to. */
type Held = { given?: Given; options?: ToolOptions; only?: readonly number[] }

/**
 * Runs the expression check over a text with the tokens of `lexicon` and
 * returns what it found of one rule, in position order. Without a lexicon
 * the check has no tokens, as when the engine is missing.
 */
export function readWith(
  rule: string,
  text: string,
  lexicon: readonly string[] | undefined,
  { given = {}, options = {}, only }: Held = {},
): Hit[] {
  const doc = readDocument(text)
  const tokens = lexicon === undefined ? new Map() : tokensOf(doc, lexicon, only)
  const conventions = resolveConventions(given, options)
  const enabled = selectRules(given, options, [expressionCheck])
  const ctx = checkContext({ doc, conventions, enabled, genre: given.genre ?? DEFAULT_GENRE, tokens })
  return expressionCheck
    .run(ctx)
    .findings.filter((item) => item.rule === rule)
    .sort((a, b) => a.start - b.start)
    .map((item) => ({ text: text.slice(item.start, item.end), start: item.start, reason: item.reason }))
}
