import { ToolError } from "../errors"
import type { ToolOptions } from "../tool"
import { DEFAULT_GENRE, type CheckSpec, type Genre, type RuleSpec, type Stance } from "./rules"

/**
 * What a call's arguments say about which rules run: the rule lists, where a
 * list that is given replaces the setting of the same name, and the genre and
 * the stance, which turn off the rules that do not fit them.
 */
export type RuleArguments = {
  rules?: readonly string[]
  exclude_rules?: readonly string[]
  genre?: Genre
  stance?: Stance
}

type RuleListName = "rules" | "exclude_rules"

/** The most unknown ids one refusal names, so a long list does not fill the message. */
const MAX_NAMED_IDS = 10

type RuleList = { ids: readonly string[]; origin: "argument" | "setting" }

function listOf(name: RuleListName, args: RuleArguments, options: ToolOptions): RuleList {
  const given = args[name]
  if (given !== undefined) return { ids: given, origin: "argument" }
  const setting = options[name]
  return { ids: Array.isArray(setting) ? (setting as readonly string[]) : [], origin: "setting" }
}

function refuseUnknown(name: RuleListName, list: RuleList, known: ReadonlyMap<string, RuleSpec>): void {
  const unknown = [...new Set(list.ids.filter((id) => !known.has(id)))]
  if (unknown.length === 0) return
  const named = unknown.slice(0, MAX_NAMED_IDS).join(", ")
  const more = unknown.length > MAX_NAMED_IDS ? ` and ${unknown.length - MAX_NAMED_IDS} more` : ""
  throw new ToolError(
    "invalid_argument",
    `Unknown rule ${unknown.length === 1 ? "id" : "ids"} in the \`${name}\` ${list.origin}: ${named}${more}. Use rule ids the package defines.`,
  )
}

/**
 * Picks the rules that run: a rule runs when it is on by default or listed in
 * `rules`, and is not listed in `exclude_rules`; an exclusion wins. Each list
 * comes from the call's argument when given (it replaces the setting), else
 * from the setting. Whatever the lists say, a rule runs only in the genres it
 * names (the default genre when the call gives none) and, when it needs a
 * stance, only when the call gives one. An id the checks do not define is
 * refused as `invalid_argument`, naming the ids and whether they came from the
 * argument or the setting. Returns the predicate a check asks.
 */
export function selectRules(
  args: RuleArguments,
  options: ToolOptions,
  checks: readonly CheckSpec[],
): (rule: string) => boolean {
  const known = new Map<string, RuleSpec>(checks.flatMap((check) => check.rules.map((rule) => [rule.id, rule])))
  const named = listOf("rules", args, options)
  const excluded = listOf("exclude_rules", args, options)
  refuseUnknown("rules", named, known)
  refuseUnknown("exclude_rules", excluded, known)
  const turnedOn = new Set(named.ids)
  const turnedOff = new Set(excluded.ids)
  const genre = args.genre ?? DEFAULT_GENRE
  return (rule) => {
    const spec = known.get(rule)
    return (
      spec !== undefined &&
      (spec.defaultOn || turnedOn.has(rule)) &&
      !turnedOff.has(rule) &&
      (spec.genres === undefined || spec.genres.includes(genre)) &&
      (spec.needsStance !== true || args.stance !== undefined)
    )
  }
}
