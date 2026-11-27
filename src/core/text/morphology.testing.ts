import { join } from "node:path"
import type { FakeBridge } from "../engine/analyze.testing"
import type { EngineContext } from "./morphology"
import { fakeCheck, found, rule } from "./rules.testing"
import type { CheckContext, CheckSpec, RuleSpec } from "./rules"

/** Fixtures the tests of the engine in `inspect` share. */

/** The command line the fake runtime names. */
export const CLI = "demo-cli"

/** The install directory of the fake package; the fake bridge never reads the bridge file under it. */
export const OWN_DIR = "/package"

/** Where the bridge is run from, as the engine call names it. */
export const BRIDGE_FILE = join(OWN_DIR, "engine", "bridge.py")

/** The engine context of a call whose state directory is `stateDir`; `extra` replaces any part. */
export function engineAt(stateDir: string, extra: Partial<EngineContext> = {}): EngineContext {
  return {
    stateDir,
    ownDir: OWN_DIR,
    runtime: { cli: CLI, env: { PATH: "/usr/bin:/bin", HOME: "/home/user" } },
    ...extra,
  }
}

/** The engine context of a call against a fake bridge. */
export function engineOf(bridge: FakeBridge, extra: Partial<EngineContext> = {}): EngineContext {
  return engineAt(bridge.stateDir, extra)
}

/**
 * A `notation` check with a rule that needs no tokens, which finds something at
 * 0 whatever the text, and an `expression` check whose rule `m_rule` needs them
 * (`extra` changes it) and finds nothing; `seen` records the context of each
 * run of the second.
 */
export function morphologyChecks(extra: Partial<RuleSpec> = {}): { seen: CheckContext[]; checks: CheckSpec[] } {
  const seen: CheckContext[] = []
  const reading: CheckSpec = {
    name: "expression",
    rules: [rule("m_rule", { check: "expression", morphology: true, ...extra })],
    run(ctx) {
      seen.push(ctx)
      return { findings: [] }
    },
  }
  return { seen, checks: [fakeCheck("notation", [rule("n_rule")], [found("n_rule", 0)]), reading] }
}

/** The segments the fake bridge received in its last call. */
export async function sentSegments(bridge: FakeBridge): Promise<string[]> {
  return (JSON.parse(await bridge.recorded("stdin")) as { segments: string[] }).segments
}
