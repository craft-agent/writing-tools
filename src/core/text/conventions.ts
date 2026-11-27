import type { ToolOptions } from "../tool"

/** One convention: the values its setting and argument accept, `document` first, and what it decides. */
export type ConventionSpec = { values: readonly [string, ...string[]]; decides: string }

/** The word that holds a text to what it does itself instead of to a given value. */
export const DOCUMENT_VALUE = "document"

/**
 * The ten conventions, in the order the settings list them. Each is a `text`
 * setting and an argument of the same name; the package's options are built
 * from this table, so the settings, the arguments and the report agree.
 */
export const CONVENTIONS = {
  register: {
    values: [DOCUMENT_VALUE, "polite", "plain"],
    decides: "sentence endings in body text: です・ます (`polite`) or だ・である (`plain`)",
  },
  latin_spacing: {
    values: [DOCUMENT_VALUE, "spaced", "unspaced"],
    decides: "a space between Japanese and a Latin word or inline code",
  },
  unit_spacing: {
    values: [DOCUMENT_VALUE, "spaced", "unspaced"],
    decides: "a space between a numeral and a Latin unit, as in `100 MB`",
  },
  alnum_width: {
    values: [DOCUMENT_VALUE, "halfwidth", "fullwidth"],
    decides: "the width of Latin letters and digits",
  },
  bracket_width: {
    values: [DOCUMENT_VALUE, "fullwidth", "halfwidth"],
    decides: "the parentheses around Japanese text",
  },
  punctuation: {
    values: [DOCUMENT_VALUE, "ten_maru", "comma_period", "comma_maru"],
    decides: "sentence punctuation: 、。 (`ten_maru`), ，． (`comma_period`) or ，。 (`comma_maru`)",
  },
  quotes: {
    values: [DOCUMENT_VALUE, "corner", "double"],
    decides: "quotation marks around Japanese text: 「」 (`corner`) or double quotation marks (`double`)",
  },
  range_mark: {
    values: [DOCUMENT_VALUE, "wave_dash", "fullwidth_tilde", "hyphen"],
    decides: "the mark between two numbers: 〜 (`wave_dash`), ～ (`fullwidth_tilde`) or a hyphen (`hyphen`)",
  },
  long_vowel: {
    values: [DOCUMENT_VALUE, "keep", "drop"],
    decides: "the closing ー of katakana words such as コンピューター",
  },
  counter_ka: {
    values: [DOCUMENT_VALUE, "hiragana", "small_ke", "katakana"],
    decides: "か, ヶ or カ in counters such as 3か月",
  },
} as const satisfies Record<string, ConventionSpec>

/** The name of a convention. */
export type ConventionName = keyof typeof CONVENTIONS

/** Every convention's name, in the table's order. */
export const CONVENTION_NAMES = Object.keys(CONVENTIONS) as ConventionName[]

/** Where a convention's value came from, as the report names it. */
export const CONVENTION_SOURCES = ["argument", "setting", "document", "unset"] as const

/** One of {@link CONVENTION_SOURCES}. */
export type ConventionSource = (typeof CONVENTION_SOURCES)[number]

/** What a convention was held to: a value, or `null` when nothing is expected, and where that came from. */
export type ResolvedConvention = { value: string | null; source: ConventionSource }

/** Every convention's resolved value. */
export type ResolvedConventions = Record<ConventionName, ResolvedConvention>

/** The convention arguments of a call; the schema has already limited each to its values. */
export type ConventionArguments = Partial<Record<ConventionName, string>>

function unset(): ResolvedConvention {
  return { value: null, source: "unset" }
}

function fromValue(value: unknown, source: "argument" | "setting"): ResolvedConvention | undefined {
  if (typeof value !== "string") return undefined
  return value === DOCUMENT_VALUE ? unset() : { value, source }
}

/**
 * Resolves each convention: the call's argument first, then the setting. A
 * value of `document`, given or defaulted, holds the text to what it does
 * itself, which is not read here, so it resolves to `{ value: null, source:
 * "unset" }`; a given `document` still wins over a setting. The report's
 * `document` source is for the value a text's own majority settles, which
 * {@link withSettled} fills in after the checks ran.
 */
export function resolveConventions(args: ConventionArguments, options: ToolOptions = {}): ResolvedConventions {
  return Object.fromEntries(
    CONVENTION_NAMES.map((name) => [
      name,
      fromValue(args[name], "argument") ?? fromValue(options[name], "setting") ?? unset(),
    ]),
  ) as ResolvedConventions
}

/**
 * The conventions with the values the text's own majority settled: each
 * convention that was held to nothing and has a settled value becomes
 * `{ value, source: "document" }`. A convention that was given a value stays
 * as it is, and one the text never used stays unset.
 */
export function withSettled(
  conventions: ResolvedConventions,
  settled: Partial<Record<ConventionName, string>>,
): ResolvedConventions {
  return Object.fromEntries(
    CONVENTION_NAMES.map((name) => {
      const value = settled[name]
      const held = conventions[name]
      return [name, held.value === null && value !== undefined ? { value, source: "document" } : held]
    }),
  ) as ResolvedConventions
}
