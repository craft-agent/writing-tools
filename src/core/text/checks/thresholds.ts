import type { ToolOptions } from "../../tool"
import type { Genre, Thresholds } from "../rules"

/**
 * The thresholds of the expression and readability rules by genre, as the
 * package's own data. A rule that runs only in some genres (its spec says
 * which) needs no value for the others, and the table gives them the same one.
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

/** The contrast constructions `contrast_overuse` needs before it speaks, so a few uses in a short text are never a habit. */
export const CONTRAST_MIN_COUNT = 3

/** The contrast constructions per counted sentence at which `contrast_overuse` reports. */
export const CONTRAST_PER_SENTENCE: Record<Genre, number> = {
  general: 0.05,
  technical: 0.08,
  business: 0.05,
  essay: 0.05,
}

/** The sentences that open with the same two words at which `repeated_lead` reports. */
export const LEAD_REPEAT: Record<Genre, number> = {
  general: 6,
  technical: 7,
  business: 7,
  essay: 5,
}

/** The readable characters `lexical_repetition` needs before it speaks: the range of a short text is not a habit. */
export const LEXICAL_MIN_CHARS = 4000

/** The content words `lexical_repetition` needs before it measures their range. */
export const LEXICAL_MIN_WORDS = 100

/** The type-token ratio at which a stretch of words ends a factor in MTLD; 0.72 is the value its authors give. */
export const MTLD_FACTOR = 0.72

/** The MTLD below which `lexical_repetition` reports: the text reuses a small stock of words for its length. */
export const MTLD_BELOW = 40

/** How many of the most repeated words `lexical_repetition` names. */
export const LEXICAL_TOP_WORDS = 3

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

/** The characters past which `long_sentence` reports, when the `sentence_length` setting is unset. */
export const SENTENCE_LENGTH: Record<Genre, number> = {
  general: 90,
  technical: 90,
  business: 90,
  essay: 110,
}

/** The kanji in a row past which `kanji_run` reports, when the `kanji_run` setting is unset. */
export const KANJI_RUN: Record<Genre, number> = {
  general: 6,
  technical: 6,
  business: 6,
  essay: 6,
}

/** The case-marking の in a row past which a chain is reported, when the `no_chain` setting is unset. */
export const NO_CHAIN: Record<Genre, number> = {
  general: 2,
  technical: 2,
  business: 2,
  essay: 2,
}

/** The genre's value of each threshold, by the name of the setting that moves it. */
const GENRE_THRESHOLDS: Record<keyof Thresholds, Record<Genre, number>> = {
  sentence_length: SENTENCE_LENGTH,
  kanji_run: KANJI_RUN,
  no_chain: NO_CHAIN,
}

/**
 * The thresholds a call holds the text to: each setting's value when it is
 * given, else the genre's. A setting holds every genre to its value.
 */
export function resolveThresholds(options: ToolOptions, genre: Genre): Thresholds {
  const resolve = (name: keyof Thresholds): number => {
    const given = options[name]
    return typeof given === "number" && Number.isFinite(given) ? given : GENRE_THRESHOLDS[name][genre]
  }
  return { sentence_length: resolve("sentence_length"), kanji_run: resolve("kanji_run"), no_chain: resolve("no_chain") }
}

/** The tokens at most between one case-marking の and the next for them to belong to one chain in `no_chain`. */
export const NO_CHAIN_MAX_GAP = 3

/** The tokens at most between two negations for them to form one double negative in `double_negative`. */
export const DOUBLE_NEGATIVE_MAX_GAP = 6

/**
 * The items a list buried in a sentence needs before `buried_list` reports it,
 * and the sentence length (compact characters) at which it does, longest list
 * first: the more items, the shorter the sentence that is too crowded.
 */
export const BURIED_LIST_LIMITS: readonly { items: number; length: number }[] = [
  { items: 4, length: 50 },
  { items: 3, length: 80 },
]

/** The comma-ended clauses in a row at which `comma_run` reports. */
export const COMMA_RUN_MIN_CLAUSES = 3

/** The non-whitespace characters at most which a clause counts as short for `comma_run`. */
export const COMMA_CLAUSE_MAX_LENGTH = 12

/** The clauses of a `comma_run` that must end in a particle or a conjunctive form, so a plain list of nouns is not one. */
export const COMMA_RUN_MIN_LINKED = 2
