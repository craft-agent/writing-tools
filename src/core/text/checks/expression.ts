import type { CheckSpec, RuleSpec } from "../rules"
import { judgeConvention } from "./convention"
import { findRegister } from "./register"

/** The `register` rule: a convention rule on by default that needs no morphology, explained in `expression.md`. */
const REGISTER_RULE: RuleSpec = {
  id: "register",
  check: "expression",
  severity: "warn",
  defaultOn: true,
  morphology: false,
  reference: "expression.md#register",
}

/**
 * Voice and wording: today the register of the sentences, held to the
 * `register` convention's value or to the text's own majority. A rule that is
 * off is neither run nor settled.
 */
export const expressionCheck: CheckSpec = {
  name: "expression",
  rules: [REGISTER_RULE],
  run(ctx) {
    return ctx.enabled(REGISTER_RULE.id) ? judgeConvention(ctx, "register", findRegister(ctx.doc)) : { findings: [] }
  },
}
