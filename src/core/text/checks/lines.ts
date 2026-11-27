import type { LineKind, TextDocument } from "../model"
import { CODE_CHAR, LINK_CHAR } from "./chars"

/** One line of the text a rule reads: its content as a view, where the view starts in `doc.text`, and the kind of line it is. */
export type LineView = { start: number; text: string; kind: LineKind }

/** The kinds of line a notation rule reads; a quotation is someone else's text, and an excluded line is never checked. */
const READ_KINDS: ReadonlySet<LineKind> = new Set(["prose", "heading", "list", "table"])

/** The masked text with every unit of inline code and of a link target given its own character. */
function markedText(doc: TextDocument): string {
  const parts: string[] = []
  let at = 0
  for (const { start, end, kind } of doc.masks) {
    const mark = kind === "code" ? CODE_CHAR : kind === "link_target" ? LINK_CHAR : undefined
    if (mark === undefined) continue
    parts.push(doc.masked.slice(at, start), mark.repeat(end - start))
    at = end
  }
  parts.push(doc.masked.slice(at))
  return parts.join("")
}

/**
 * The lines of prose, headings, list items and table rows, each from its
 * content start to its content end, read from the masked text. Inline code
 * shows as {@link CODE_CHAR} and a link target as {@link LINK_CHAR}; every
 * other masked unit stays the mask character. A view never holds a line
 * break, so a rule that reads a view never reads across lines.
 */
export function readableLines(doc: TextDocument): LineView[] {
  const marked = markedText(doc)
  return doc.lines
    .filter((line) => READ_KINDS.has(line.kind))
    .map((line) => ({
      start: line.contentStart,
      text: marked.slice(line.contentStart, line.contentEnd),
      kind: line.kind,
    }))
}
