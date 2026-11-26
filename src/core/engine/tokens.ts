/** A token's part of speech: the six tags SudachiPy reports, from the coarsest to the finest. */
export type PartOfSpeech = readonly [string, string, string, string, string, string]

/** One morpheme of a segment. */
export type Token = {
  surface: string
  /** UTF-16 offsets into the segment string, as JavaScript indexes it: `segment.slice(start, end) === surface`. */
  start: number
  end: number
  pos: PartOfSpeech
  normalized: string
  dictionary: string
  reading: string
}

/** How finely the analyzer splits: A is the shortest units, C the longest. */
export type SplitMode = "A" | "B" | "C"

/** What the engine made of one segment: its tokens, or why the segment was left out. */
export type SegmentAnalysis = { tokens: readonly Token[] } | { skipped: "segment_too_long" | "morphology_failed" }

/** Why the rules that need tokens did not run, as `not_run` names it. */
export type NotRunReason = "morphology_unavailable" | "morphology_failed"

/**
 * The outcome of one engine call. `segments` holds one entry per input
 * segment, in input order. When the engine is unavailable, `engine_status` and
 * `action` say why and what installs it; `detail` is a fixed short phrase for a
 * failed call and never holds any of the text.
 */
export type Morphology =
  | { available: true; segments: readonly SegmentAnalysis[] }
  | {
      available: false
      reason: NotRunReason
      engine_status?: "missing" | "mismatch"
      action?: "engine_install"
      detail?: string
    }
