import { resolveThresholds } from "./checks/thresholds"
import {
  DEFAULT_GENRE,
  type CheckContext,
  type CheckName,
  type CheckSpec,
  type RawFinding,
  type RuleSpec,
} from "./rules"

/** A rule that is on by default, a `warn` of the `notation` check, unless `extra` says otherwise. */
export function rule(id: string, extra: Partial<RuleSpec> = {}): RuleSpec {
  return {
    id,
    check: "notation",
    severity: "warn",
    defaultOn: true,
    morphology: false,
    reference: `notation.md#${id}`,
    ...extra,
  }
}

/** A check that finds what `found` says, whatever the document. */
export function fakeCheck(name: CheckName, rules: readonly RuleSpec[], found: readonly RawFinding[] = []): CheckSpec {
  return { name, rules, run: () => ({ findings: [...found] }) }
}

/** The context of a check called directly: the general genre and its thresholds, no stance and no tokens unless `parts` say otherwise. */
export function checkContext(
  parts: Pick<CheckContext, "doc" | "conventions" | "enabled"> & Partial<CheckContext>,
): CheckContext {
  const genre = parts.genre ?? DEFAULT_GENRE
  return { genre, thresholds: resolveThresholds({}, genre), stance: undefined, tokens: new Map(), ...parts }
}

/** A finding of `rule` over `[start, end)`, with a reason naming the rule. */
export function found(rule: string, start: number, end: number = start, extra: Partial<RawFinding> = {}): RawFinding {
  return { rule, start, end, reason: `${rule} reason`, ...extra }
}
