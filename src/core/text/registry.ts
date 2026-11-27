import { expressionCheck } from "./checks/expression"
import { notationCheck } from "./checks/notation"
import { readabilityCheck } from "./checks/readability"
import type { CheckSpec } from "./rules"

/** Every check of the package, in the order of `CHECKS`; a new check is a module under `checks/` and one entry here. */
export const CHECK_SPECS: readonly CheckSpec[] = [notationCheck, expressionCheck, readabilityCheck]
