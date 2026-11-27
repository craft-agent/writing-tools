/** How a line reads: body text, a heading, a list item, a table row, a quotation, or text no check reads. */
export type LineKind = "prose" | "heading" | "list" | "table" | "quote" | "excluded"

/** What a masked span is: the reason its text is never checked. */
export type MaskKind = "front_matter" | "code_block" | "code" | "url" | "link_target" | "html" | "comment" | "escape"

/** A span of the text that no check reads: UTF-16 offsets into the text as given, `end` exclusive. */
export type Mask = { start: number; end: number; kind: MaskKind }

/** The character that stands in `masked` for every masked UTF-16 unit. */
export const MASK_CHAR = "\u0000"

/** One line of the text, with the part of it a check reads. */
export type Line = {
  /** 1-based. */
  number: number
  /** Offsets of the line's content, its line break excluded. */
  start: number
  end: number
  kind: LineKind
  /** The offset after the block markers (`# `, `- `, `1. `, `- [ ] `, `> `) and the indentation; `start` for prose. */
  contentStart: number
  /** The offset before a heading's closing hashes and trailing spaces; `end` for every other line. */
  contentEnd: number
  /** A heading's level, 1 to 6, for ATX and setext headings. */
  level?: number
}

/** The lines that read as one unit: a paragraph, a list item with its continuation lines, a heading, a table row or a quotation paragraph. */
export type Block = {
  kind: Exclude<LineKind, "excluded">
  /** From the first line's `contentStart` to the last line's `contentEnd`. */
  start: number
  end: number
  /** The numbers of its lines. */
  lines: readonly number[]
}

/** The blocks the rules that need tokens read; headings, table rows and quotations are left out. */
export const SEGMENT_KINDS: readonly Block["kind"][] = ["prose", "list"]

/** The characters that end a sentence. */
export const TERMINATORS = ["。", "！", "？", "!", "?", "．"] as const

/** A character from {@link TERMINATORS}. */
export type Terminator = (typeof TERMINATORS)[number]

/** One sentence of a block. */
export type Sentence = {
  /** Offsets into the text; `end` is after the terminator and the closing brackets and quotes that follow it. */
  start: number
  end: number
  /** The kind of the block the sentence belongs to. */
  kind: Exclude<LineKind, "excluded">
  /** `null` when the block ended without one. */
  terminator: Terminator | null
}

/** A text read as lines, blocks and sentences, every position pointing into the text as given. */
export type TextDocument = {
  /** The text as given. */
  text: string
  /** The text with every masked UTF-16 unit replaced by {@link MASK_CHAR}; line breaks are kept. */
  masked: string
  /** Sorted by `start`, never overlapping. */
  masks: readonly Mask[]
  lines: readonly Line[]
  blocks: readonly Block[]
  sentences: readonly Sentence[]
}
