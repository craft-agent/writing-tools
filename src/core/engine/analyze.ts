import { Buffer } from "node:buffer"
import { z } from "zod"
import { isAbortError, isToolError } from "../errors"
import { run } from "../runner"
import { enginePaths, readEngineState, type EnginePaths } from "./state"
import type { Morphology, PartOfSpeech, SegmentAnalysis, SplitMode, Token } from "./tokens"

/** The longest segment, in bytes of UTF-8, that is sent to the engine; the bridge refuses one above it too. */
export const MAX_SEGMENT_BYTES = 40_000

/** How long the engine may run before it is stopped. */
const DEFAULT_TIMEOUT_MS = 30_000

/** The engine's name in messages. */
const ENGINE_NAME = "The engine"

/** Fixed for the bridge: its streams are UTF-8 and it writes no bytecode. */
const ENGINE_SET = { PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1" } as const

/** A lone surrogate half, which has no UTF-8 form and so cannot reach the bridge. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

const SKIPPED_FAILED: SegmentAnalysis = { skipped: "morphology_failed" }

const posSchema = z.tuple([z.string(), z.string(), z.string(), z.string(), z.string(), z.string()])
const tokenSchema = z.tuple([z.string(), z.int(), z.int(), z.int(), z.string(), z.string(), z.string()])
const segmentSchema = z.union([
  z.object({ tokens: z.array(tokenSchema) }),
  z.object({ error: z.enum(["segment_too_long", "tokenize_failed"]) }),
])
const replySchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), pos: z.array(posSchema), segments: z.array(segmentSchema) }),
  z.object({
    ok: z.literal(false),
    kind: z.enum(["invalid_request", "engine_missing", "dictionary_failed"]),
    error: z.string(),
  }),
])

type SegmentReply = z.infer<typeof segmentSchema>

/** What `analyze` needs. */
export type AnalyzeOptions = {
  stateDir: string
  /** `<package root>/engine/bridge.py` */
  bridgeFile: string
  /** The paragraphs to analyze; the result has one entry for each, in this order. */
  segments: readonly string[]
  /** Defaults to `C`. */
  mode?: SplitMode
  /** The environment the base variables are read from; no network variable is passed on. */
  env: Readonly<Record<string, string | undefined>>
  signal?: AbortSignal
  /** The limit on the child; defaults to `DEFAULT_TIMEOUT_MS`. */
  timeoutMs?: number
}

type Interpreted = { segments: SegmentAnalysis[] } | { detail: string }

function failed(detail: string): Morphology {
  return { available: false, reason: "morphology_failed", detail }
}

/** The engine's paths when it is ready, else its status; a state directory that cannot be read counts as missing. */
async function readyEngine(stateDir: string): Promise<EnginePaths | "missing" | "mismatch"> {
  try {
    const state = await readEngineState(stateDir)
    return state.status === "ready" ? enginePaths(stateDir) : state.status
  } catch {
    return "missing"
  }
}

/** Where each code point of `text` starts as a UTF-16 index, with the length of `text` as the last entry. */
function codePointOffsets(text: string): number[] {
  const offsets: number[] = []
  let index = 0
  for (const char of text) {
    offsets.push(index)
    index += char.length
  }
  offsets.push(index)
  return offsets
}

/** The token a raw entry stands for, or undefined when its offsets or surface do not fit `text` or its pos id is unknown. */
function toToken(
  raw: z.infer<typeof tokenSchema>,
  text: string,
  offsets: readonly number[],
  pos: readonly PartOfSpeech[],
): Token | undefined {
  const [surface, begin, end, posId, normalized, dictionary, reading] = raw
  const part = pos[posId]
  const start = offsets[begin]
  const stop = offsets[end]
  if (part === undefined || start === undefined || stop === undefined || begin > end) return undefined
  if (text.slice(start, stop) !== surface) return undefined
  return { surface, start, end: stop, pos: part, normalized, dictionary, reading }
}

function toAnalysis(text: string, reply: SegmentReply, pos: readonly PartOfSpeech[]): SegmentAnalysis | undefined {
  if ("error" in reply) return reply.error === "segment_too_long" ? { skipped: reply.error } : SKIPPED_FAILED
  const offsets = codePointOffsets(text)
  const tokens: Token[] = []
  for (const raw of reply.tokens) {
    const token = toToken(raw, text, offsets, pos)
    if (token === undefined) return undefined
    tokens.push(token)
  }
  return { tokens }
}

/** Reads the bridge's one reply for the segments that were sent; the detail names what was wrong, never the text. */
function interpret(stdout: string, sent: readonly string[]): Interpreted {
  let json: unknown
  try {
    json = JSON.parse(stdout.trim())
  } catch {
    return { detail: "the engine's reply was not one JSON value" }
  }
  const parsed = replySchema.safeParse(json)
  if (!parsed.success) return { detail: "the engine's reply did not have the expected shape" }
  const reply = parsed.data
  if (!reply.ok) return { detail: `the engine reported ${reply.kind}` }
  if (reply.segments.length !== sent.length) return { detail: "the engine's reply had a different number of segments" }

  const pos = reply.pos.map((tags) => Object.freeze(tags))
  const segments: SegmentAnalysis[] = []
  for (const [index, segment] of reply.segments.entries()) {
    const analysis = toAnalysis(sent[index] ?? "", segment, pos)
    if (analysis === undefined) return { detail: "the engine's offsets did not fit its segment" }
    segments.push(analysis)
  }
  return { segments }
}

/**
 * Analyzes `segments` with the engine: the venv's Python runs the bridge with
 * the request as JSON on standard input, and its tokens come back with UTF-16
 * offsets into each segment (the bridge counts code points). Nothing is kept,
 * and no network variable reaches the engine.
 *
 * Never fails for want of the engine. One that is not `ready` is reported as
 * `morphology_unavailable` without starting anything; a program that cannot be
 * run, outlives `timeoutMs`, exits non-zero, or answers with anything but a
 * well-formed reply whose offsets fit the segments is `morphology_failed`. A
 * segment over `MAX_SEGMENT_BYTES`, or one that is not valid Unicode, is not
 * sent and is skipped; the bridge's per-segment failures skip that segment
 * only. An abort is the one error that propagates.
 */
export async function analyze(options: AnalyzeOptions): Promise<Morphology> {
  const engine = await readyEngine(options.stateDir)
  if (typeof engine === "string") {
    return { available: false, reason: "morphology_unavailable", engine_status: engine, action: "engine_install" }
  }

  const merged: SegmentAnalysis[] = options.segments.map(() => SKIPPED_FAILED)
  const sent: string[] = []
  const sentAt: number[] = []
  for (const [index, text] of options.segments.entries()) {
    if (LONE_SURROGATE.test(text)) continue
    if (Buffer.byteLength(text, "utf8") > MAX_SEGMENT_BYTES) {
      merged[index] = { skipped: "segment_too_long" }
    } else {
      sent.push(text)
      sentAt.push(index)
    }
  }
  if (sent.length === 0) return { available: true, segments: merged }

  let interpreted: Interpreted
  try {
    const result = await run([engine.python, "-I", "-B", options.bridgeFile], {
      env: options.env,
      set: ENGINE_SET,
      stdin: JSON.stringify({ mode: options.mode ?? "C", segments: sent }),
      cwd: engine.dir,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      signal: options.signal,
      name: ENGINE_NAME,
    })
    if (result.code !== 0) return failed(`the engine exited with code ${result.code}`)
    interpreted = interpret(result.stdout, sent)
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) throw error
    return failed(isToolError(error) ? error.message : "the engine call failed unexpectedly")
  }
  if ("detail" in interpreted) return failed(interpreted.detail)

  for (const [position, analysis] of interpreted.segments.entries()) {
    const index = sentAt[position]
    if (index !== undefined) merged[index] = analysis
  }
  return { available: true, segments: merged }
}
