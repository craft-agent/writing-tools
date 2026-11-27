import type { Genre } from "../rules"

/**
 * The thresholds of the expression rules by genre, as the package's own data.
 * A rule that runs only in some genres (its spec says which) needs no value
 * for the others, and the table gives them the same one.
 */

/** The non-whitespace characters of readable text a density rule needs before it speaks, so a short text is never judged by its rate. */
export const DENSITY_MIN_CHARS = 300

/** The bold spans per 1,000 characters past which `bold_density` reports. */
export const BOLD_PER_THOUSAND: Record<Genre, number> = {
  general: 3.0,
  technical: 3.0,
  business: 5.0,
  essay: 3.0,
}

/** The share of readable lines that are list lines past which `list_density` reports. */
export const LIST_SHARE: Record<Genre, number> = {
  general: 0.4,
  technical: 0.4,
  business: 0.4,
  essay: 0.4,
}

/** The readable lines `list_density` needs before it speaks. */
export const LIST_MIN_LINES = 10

/** The consecutive sentences with one ending at which `ending_repetition` reports. */
export const ENDING_RUN = 3

/** What makes a sentence short for `choppy_sentences`, and how many in a row it reports. */
export type ChoppyLimits = {
  /** The characters at most which a sentence is short whatever it holds. */
  short: number
  /** The characters at most which a sentence without a clause link is short. */
  unlinked: number
  minRun: number
}

export const CHOPPY: Record<Genre, ChoppyLimits> = {
  general: { short: 22, unlinked: 38, minRun: 4 },
  technical: { short: 22, unlinked: 38, minRun: 4 },
  business: { short: 22, unlinked: 38, minRun: 4 },
  essay: { short: 22, unlinked: 38, minRun: 5 },
}

/** When the sentence lengths of a text are too even for `uniform_sentence_length`. */
export type UniformLimits = {
  /** The sentences the text needs before its lengths are judged. */
  minSentences: number
  /** The coefficient of variation (standard deviation over mean) below which the lengths are too even. */
  maxVariation: number
}

export const UNIFORM: Record<Genre, UniformLimits> = {
  general: { minSentences: 8, maxVariation: 0.25 },
  technical: { minSentences: 8, maxVariation: 0.25 },
  business: { minSentences: 8, maxVariation: 0.25 },
  essay: { minSentences: 8, maxVariation: 0.2 },
}
