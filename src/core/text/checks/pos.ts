import type { Token } from "../../engine/tokens"

/**
 * The tags of the engine's parts of speech that the token rules of the
 * readability check read: the first of a token's six for the coarse ones, the
 * second for the finer.
 */
export const NOUN = "名詞"
export const PARTICLE = "助詞"
export const CASE_PARTICLE = "格助詞"
export const CONJUNCTIVE_PARTICLE = "接続助詞"
export const NOMINALIZING_PARTICLE = "準体助詞"
export const VERB = "動詞"
export const AUXILIARY_VERB = "助動詞"
export const ADJECTIVE = "形容詞"
export const PREFIX = "接頭辞"
export const SUFFIX = "接尾辞"
export const NOUN_LIKE_SUFFIX = "名詞的"

/** The parts of speech of a token that is no word: punctuation, brackets and spaces. */
const SYMBOLS: ReadonlySet<string> = new Set(["補助記号", "空白"])

/** The parentheses whose inside the rules read as an aside. */
export const OPENING_PARENTHESES: ReadonlySet<string> = new Set([..."（("])
export const CLOSING_PARENTHESES: ReadonlySet<string> = new Set([..."）)"])

/** Whether the token is punctuation, a bracket or a space. */
export function isSymbol({ pos }: Token): boolean {
  return SYMBOLS.has(pos[0])
}

/** Whether the token is a noun. */
export function isNoun({ pos }: Token): boolean {
  return pos[0] === NOUN
}

/** Whether the token is a particle of the given kind (`格助詞`, `接続助詞`), or any particle when none is given. */
export function isParticle({ pos }: Token, kind?: string): boolean {
  return pos[0] === PARTICLE && (kind === undefined || pos[1] === kind)
}

/** Whether the token is a suffix that makes what it follows a noun (`者`, `さん`, `用`). */
export function isNounSuffix({ pos }: Token): boolean {
  return pos[0] === SUFFIX && pos[1] === NOUN_LIKE_SUFFIX
}
