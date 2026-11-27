import { chmod, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { AnalyzeOptions } from "./analyze"
import { PINNED_LAYOUT, tempDir, writeVenv } from "./engine.testing"
import { enginePaths } from "./state"
import type { Morphology, SegmentAnalysis } from "./tokens"

/** Fixtures the analysis tests share: a ready venv whose interpreter is a shell script standing in for the bridge. */

/** What the fake interpreter reads from files in its record directory, so a test steers it without passing it variables. */
type FakeBridgeSetting = "stdout" | "stderr" | "exit" | "sleep"

/** What the fake interpreter records of each call, in files of its record directory. */
type FakeBridgeRecord = "argv" | "cwd" | "stdin" | "env"

/** A bridge reply's six-field part-of-speech entry. */
type RawPos = [string, string, string, string, string, string]

/** A bridge reply's token array: surface, begin, end, pos id, normalized form, dictionary form, reading. */
type RawToken = [string, number, number, number, string, string, string]

function fakeBridgeScript(record: string): string {
  return `#!/bin/sh
rec='${record}'
echo run >> "$rec/runs"
printf '%s\\n' "$@" > "$rec/argv"
pwd > "$rec/cwd"
cat > "$rec/stdin"
env > "$rec/env"
if [ -f "$rec/stderr" ]; then cat "$rec/stderr" >&2; fi
if [ -f "$rec/sleep" ]; then sleep "$(cat "$rec/sleep")"; fi
if [ -f "$rec/stdout" ]; then cat "$rec/stdout"; fi
if [ -f "$rec/exit" ]; then exit "$(cat "$rec/exit")"; fi
`
}

/** A state directory whose engine is ready and whose interpreter is a fake bridge. */
export type FakeBridge = {
  stateDir: string
  /** The engine directory the call runs in. */
  engineDir: string
  /** A path to hand `analyze` as the bridge; the fake never reads it. */
  bridgeFile: string
  /** The options of a call against this engine, with a minimal environment and these segments. */
  options(segments: readonly string[], extra?: Partial<AnalyzeOptions>): AnalyzeOptions
  /** Makes the fake write, exit or wait differently from now on. */
  set(setting: FakeBridgeSetting, value: string): Promise<void>
  /** Makes the fake print `reply` as its one line of standard output. */
  reply(reply: unknown): Promise<void>
  /** What the fake recorded of its last run; the arguments are one per line. */
  recorded(record: FakeBridgeRecord): Promise<string>
  /** Whether the fake interpreter has been started. */
  started(): Promise<boolean>
  /** How many times the fake interpreter has been started. */
  runs(): Promise<number>
}

export const NOUN: RawPos = ["名詞", "普通名詞", "一般", "*", "*", "*"]
export const VERB: RawPos = ["動詞", "一般", "*", "*", "五段-カ行", "連用形-促音便"]

/** A token array as the bridge writes it, with the surface as its other forms and a fixed reading. */
export function rawToken(surface: string, begin: number, end: number, posId = 0): RawToken {
  return [surface, begin, end, posId, surface, surface, "ヨミ"]
}

/** The bridge's `ok` reply for the given segment entries. */
export function okReply(segments: readonly unknown[], pos: readonly RawPos[] = [NOUN, VERB]): unknown {
  return { ok: true, pos, segments }
}

/** The segments of an available result; a test that expects one fails on any other. */
export function segmentsOf(result: Morphology): readonly SegmentAnalysis[] {
  if (!result.available) throw new Error(`morphology was not available: ${result.reason}`)
  return result.segments
}

/** Lays out a ready engine in a fresh state directory with a fake interpreter. */
export async function fakeBridge(): Promise<FakeBridge> {
  const stateDir = await tempDir()
  const record = await tempDir()
  await writeVenv(stateDir, PINNED_LAYOUT)
  const { dir, python } = enginePaths(stateDir)
  await writeFile(python, fakeBridgeScript(record))
  await chmod(python, 0o755)
  const set = (setting: FakeBridgeSetting, value: string) => writeFile(join(record, setting), value)
  const bridgeFile = "/package/engine/bridge.py"
  return {
    stateDir,
    engineDir: dir,
    bridgeFile,
    options: (segments, extra) => ({
      stateDir,
      bridgeFile,
      segments,
      env: { PATH: "/usr/bin:/bin", HOME: "/home/user" },
      ...extra,
    }),
    set,
    reply: (reply) => set("stdout", `${JSON.stringify(reply)}\n`),
    recorded: (name) => readFile(join(record, name), "utf8"),
    started: () =>
      readFile(join(record, "argv"), "utf8").then(
        () => true,
        () => false,
      ),
    runs: () =>
      readFile(join(record, "runs"), "utf8").then(
        (log) => log.trim().split("\n").length,
        () => 0,
      ),
  }
}
