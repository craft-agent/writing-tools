/** The package's own data for `inanimate_subject`: the subjects and the verbs of the construction. */

/** The demonstratives that stand for a statement as a subject, tagged 代名詞. */
export const SUBJECT_PRONOUNS: readonly string[] = ["これ", "それ", "あれ"]

/** The abstract nouns that stand for a statement as a subject, tagged 名詞; `この` or `その` may come before one (`この事実`, `そのこと`). */
export const SUBJECT_NOUNS: readonly string[] = ["こと", "事実"]

/** The words, tagged 連体詞, that open a subject noun and belong to it. */
export const SUBJECT_MODIFIERS: readonly string[] = ["この", "その", "あの"]

/** The particles, tagged 助詞, that make the word before them the subject. */
export const SUBJECT_PARTICLES: readonly string[] = ["が", "は"]

/**
 * The verbs, by dictionary form, that a plain statement turns into a claim
 * about what the subject does, as in `この事実は問題の深さを物語っている`. A
 * noun and `する` or `にする` after it count as the verb they make
 * (`意味` and `する`, `浮き彫り` and `にする`).
 */
export const CLAIM_VERBS: ReadonlySet<string> = new Set([
  "もたらす",
  "示す",
  "意味する",
  "証明する",
  "生み出す",
  "反映する",
  "示唆する",
  "物語る",
  "浮き彫りにする",
  "後押しする",
])
