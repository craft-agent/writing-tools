import type { CheckName, CheckSpec, RawFinding, RuleSpec } from "./rules"

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

/** A finding of `rule` over `[start, end)`, with a reason naming the rule. */
export function found(rule: string, start: number, end: number = start, extra: Partial<RawFinding> = {}): RawFinding {
  return { rule, start, end, reason: `${rule} reason`, ...extra }
}
