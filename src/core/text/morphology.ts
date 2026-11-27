import { join } from "node:path"
import { analyze } from "../engine/analyze"
import type { Morphology, SegmentAnalysis, Token } from "../engine/tokens"
import type { ToolContext } from "../tool"
import { MAX_NOT_RUN_LINES } from "./limits"
import { MASK_CHAR, SEGMENT_KINDS, type Block, type TextDocument } from "./model"
import type { RuleSpec } from "./rules"
import { NOT_RUN_ORIGINAL, type NotRun } from "./schemas"

/** What reading morphology takes from the call's context. */
export type EngineContext = Pick<ToolContext, "stateDir" | "ownDir" | "runtime" | "signal">

/** The tokens of the blocks the engine analyzed, and what that leaves the rules that need them unable to read. */
export type MorphologyReading = {
  /** By the index of the block in `doc.blocks`, offsets in `doc.text`. */
  tokens: ReadonlyMap<number, readonly Token[]>
  notRun: NotRun[]
}

/** The tokens of the two texts of a `compare` call, and what that leaves the rules that need them unable to read. */
export type ComparedMorphologyReading = MorphologyReading & {
  /** Like `tokens`, for the original: by the index of the block in the original's `blocks`, offsets in its text. */
  originalTokens: ReadonlyMap<number, readonly Token[]>
}

/** A text the engine reads, with what `not_run` calls its lines when it is not the call's own text. */
type ReadText = { doc: TextDocument; text?: NotRun["text"] }

/** Where the bridge sits under the install directory. */
const BRIDGE_PATH = ["engine", "bridge.py"] as const

/** What `not_run` says a person runs to install the engine, after the command line's name. */
const INSTALL_COMMAND = "engine install"

/** The reasons a block can be skipped for while the engine itself ran. */
const SKIP_REASONS = ["segment_too_long", "morphology_failed"] as const

/** What an unconfigured call gets: no state directory, install directory or runtime to run the engine from. */
const NOT_CONFIGURED: Morphology = { available: false, reason: "morphology_unavailable" }

/** The characters of a segment that are blanked: masked units and line breaks. */
const BLANKED = new RegExp(`[${MASK_CHAR}\\r\\n]`, "g")

type SegmentBlock = { index: number; block: Block }

/** The text of a block as the engine reads it: the block's length, masked units and line breaks blanked, so an offset in it is an offset in the block. */
function segmentOf(doc: TextDocument, block: Block): string {
  return doc.masked.slice(block.start, block.end).replace(BLANKED, " ")
}

function skipNotRun(
  rule: RuleSpec,
  reason: (typeof SKIP_REASONS)[number],
  lines: ReadonlySet<number>,
  text: NotRun["text"],
): NotRun {
  return {
    check: rule.check,
    rule: rule.id,
    reason,
    lines: [...lines].sort((a, b) => a - b).slice(0, MAX_NOT_RUN_LINES),
    ...(text !== undefined && { text }),
  }
}

/** One entry per rule for the engine as a whole not running; the install command only where there is a runtime to name it. */
function unavailableNotRun(
  rules: readonly RuleSpec[],
  result: Extract<Morphology, { available: false }>,
  cli?: string,
) {
  const action = result.action === "engine_install" && cli !== undefined ? `${cli} ${INSTALL_COMMAND}` : undefined
  return rules.map((rule): NotRun => ({
    check: rule.check,
    rule: rule.id,
    reason: result.reason,
    ...(action !== undefined && { action }),
  }))
}

/** The tokens of the analyzed blocks with their offsets moved from the segment into the text, and the lines of the blocks the engine skipped, by reason. */
function readSegments(blocks: readonly SegmentBlock[], segments: readonly SegmentAnalysis[]) {
  const tokens = new Map<number, readonly Token[]>()
  const skipped = new Map<(typeof SKIP_REASONS)[number], Set<number>>()
  for (const [position, { index, block }] of blocks.entries()) {
    const segment = segments[position]
    if (segment === undefined || "skipped" in segment) {
      const reason = segment === undefined ? "morphology_failed" : segment.skipped
      const lines = skipped.get(reason) ?? new Set<number>()
      for (const line of block.lines) lines.add(line)
      skipped.set(reason, lines)
    } else {
      tokens.set(
        index,
        segment.tokens.map((token) => ({ ...token, start: token.start + block.start, end: token.end + block.start })),
      )
    }
  }
  return { tokens, skipped }
}

/**
 * Reads `texts` for `rules` in one engine call: the segments of every text, in
 * order, and the tokens of each text, in the order of `texts`. Starts nothing
 * when no rule needs tokens or no text has a block to read.
 */
async function readTexts(
  texts: readonly ReadText[],
  rules: readonly RuleSpec[],
  engine: EngineContext,
): Promise<{ tokens: Map<number, readonly Token[]>[]; notRun: NotRun[] }> {
  const blocks = texts.map(({ doc }) =>
    doc.blocks.flatMap((block, index): SegmentBlock[] =>
      SEGMENT_KINDS.includes(block.kind) ? [{ index, block }] : [],
    ),
  )
  const unread = () => texts.map(() => new Map<number, readonly Token[]>())
  if (rules.length === 0 || blocks.every((own) => own.length === 0)) return { tokens: unread(), notRun: [] }

  const { stateDir, ownDir, runtime, signal } = engine
  const result =
    stateDir === undefined || ownDir === undefined || runtime === undefined
      ? NOT_CONFIGURED
      : await analyze({
          stateDir,
          bridgeFile: join(ownDir, ...BRIDGE_PATH),
          segments: texts.flatMap(({ doc }, at) => blocks[at].map(({ block }) => segmentOf(doc, block))),
          env: runtime.env,
          signal,
        })
  if (!result.available) return { tokens: unread(), notRun: unavailableNotRun(rules, result, runtime?.cli) }

  let from = 0
  const readings = blocks.map((own) => {
    const reading = readSegments(own, result.segments.slice(from, from + own.length))
    from += own.length
    return reading
  })
  const notRun = rules.flatMap((rule) =>
    SKIP_REASONS.flatMap((reason) =>
      texts.flatMap(({ text }, at) => {
        const lines = readings[at].skipped.get(reason)
        return lines === undefined ? [] : [skipNotRun(rule, reason, lines, text)]
      }),
    ),
  )
  return { tokens: readings.map(({ tokens }) => tokens), notRun }
}

/**
 * Reads the morphology of the blocks of prose and list items for `rules`, the
 * enabled rules that need tokens: one engine call, its segments the blocks
 * with masked characters and line breaks blanked. Starts nothing when no rule
 * needs tokens or the text has no such block. Never fails for want of the
 * engine: without a state directory, install directory or runtime, or with an
 * engine that is not ready or fails, no block has tokens and each rule is
 * listed as not run; blocks the engine skipped are listed per rule with their
 * lines. A cancellation is the one error that propagates.
 */
export async function readMorphology(
  doc: TextDocument,
  rules: readonly RuleSpec[],
  engine: EngineContext,
): Promise<MorphologyReading> {
  const {
    tokens: [tokens],
    notRun,
  } = await readTexts([{ doc }], rules, engine)
  return { tokens, notRun }
}

/**
 * Reads the revision and its original as {@link readMorphology} reads one
 * text, in the same single engine call: the revision's segments, then the
 * original's. Blocks the engine skipped are listed per rule, those of the
 * original with `text: "original"`.
 */
export async function readComparedMorphology(
  doc: TextDocument,
  original: TextDocument,
  rules: readonly RuleSpec[],
  engine: EngineContext,
): Promise<ComparedMorphologyReading> {
  const {
    tokens: [tokens, originalTokens],
    notRun,
  } = await readTexts([{ doc }, { doc: original, text: NOT_RUN_ORIGINAL }], rules, engine)
  return { tokens, originalTokens, notRun }
}
