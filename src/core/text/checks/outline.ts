import { locate } from "../document"
import { leadOf } from "../excerpt"
import type { Line, TextDocument } from "../model"
import type { CheckSpec } from "../rules"
import type { Outline } from "../schemas"
import { PER_THOUSAND, readableChars, renderedBold } from "./density"
import { readableLines, type LineView } from "./lines"

/** The decimals of a share of lines. */
const SHARE_DECIMALS = 3

/** The decimals of the bold spans per 1,000 characters. */
const RATE_DECIMALS = 2

/** A heading and the readable lines under it, up to the next heading of any level. */
type Section = { line: Line; views: LineView[] }

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

/** `part` over `whole`, 0 when there is no whole. */
function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole
}

/**
 * The headings of the text, each with the readable lines up to the next one.
 * `views` are the readable lines in order, so the headings among them are the
 * document's heading lines in order; text before the first heading is no
 * section.
 */
function sectionsOf(doc: TextDocument, views: readonly LineView[]): Section[] {
  const headingLines = doc.lines.filter(({ kind }) => kind === "heading")
  const sections: Section[] = []
  for (const view of views) {
    if (view.kind === "heading") sections.push({ line: headingLines[sections.length], views: [] })
    else sections.at(-1)?.views.push(view)
  }
  return sections
}

function headingsOf(doc: TextDocument, views: readonly LineView[]): Outline["headings"] {
  return sectionsOf(doc, views).map(({ line, views: body }) => ({
    level: line.level!,
    line: line.number,
    column: locate(doc, line.contentStart).column,
    text: leadOf(doc.text.slice(line.contentStart, line.contentEnd)),
    chars: readableChars(body),
  }))
}

/** The figures over the non-blank readable lines: what share are bold, list or heading lines, and how much bold there is for the text's length. */
function measuresOf(doc: TextDocument, views: readonly LineView[]): Outline["measures"] {
  const lines = views.filter(({ text }) => text.trim() !== "")
  const chars = readableChars(lines)
  const boldPerLine = lines.map((line) => renderedBold(doc, [line]).length)
  const boldSpans = boldPerLine.reduce((sum, spans) => sum + spans, 0)
  const boldLines = boldPerLine.filter((spans) => spans > 0).length
  const listLines = lines.filter(({ kind }) => kind === "list").length
  const headingLines = lines.filter(({ kind }) => kind === "heading").length
  return {
    lines: lines.length,
    chars,
    bold_lines: boldLines,
    list_lines: listLines,
    heading_lines: headingLines,
    bold_spans: boldSpans,
    bold_share: round(ratio(boldLines, lines.length), SHARE_DECIMALS),
    list_share: round(ratio(listLines, lines.length), SHARE_DECIMALS),
    heading_share: round(ratio(headingLines, lines.length), SHARE_DECIMALS),
    bold_per_thousand: round(ratio(boldSpans, chars) * PER_THOUSAND, RATE_DECIMALS),
  }
}

/** The outline of a text: its headings with their levels and section sizes, and the measures of its readable lines. */
export function outlineOf(doc: TextDocument): Outline {
  const views = readableLines(doc)
  return { headings: headingsOf(doc, views), measures: measuresOf(doc, views) }
}

/**
 * An inventory with no rules and no finding: the headings with their levels,
 * positions and section sizes, and how much of the text is bold, list and
 * heading lines. A heading tree is neither right nor wrong, so nothing is
 * judged.
 */
export const outlineCheck: CheckSpec = {
  name: "outline",
  rules: [],
  run: ({ doc }) => ({ findings: [], outline: outlineOf(doc) }),
}
