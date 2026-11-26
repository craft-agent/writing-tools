import { buildBlocks } from "./blocks"
import { classifyLines, type LineRange } from "./classify"
import { maskSpans } from "./inline"
import type { TextDocument } from "./model"
import { splitSentences } from "./sentences"

const LINE_FEED = 10
const CARRIAGE_RETURN = 13

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

/** The content range of every line, split on `\r\n`, `\r` or `\n`; a text that ends with a line break ends with an empty line. */
function splitLines(text: string): LineRange[] {
  const ranges: LineRange[] = []
  let start = 0
  for (let at = 0; at < text.length; at++) {
    const code = text.charCodeAt(at)
    if (code !== LINE_FEED && code !== CARRIAGE_RETURN) continue
    ranges.push({ start, end: at })
    if (code === CARRIAGE_RETURN && text.charCodeAt(at + 1) === LINE_FEED) at++
    start = at + 1
  }
  ranges.push({ start, end: text.length })
  return ranges
}

/**
 * Reads a Markdown text as masked text, classified lines, blocks and
 * sentences. Every offset points into `text` as given; the text is not kept.
 */
export function readDocument(text: string): TextDocument {
  const { lines, masks, itemStarts } = classifyLines(text, splitLines(text))
  const masked = maskSpans(text, masks)
  const blocks = buildBlocks(lines, itemStarts)
  return { text, masked, masks, lines, blocks, sentences: splitSentences(masked, lines, blocks) }
}

/** The 1-based line of an offset and its 1-based column, counted in code points from the line's start. */
export function locate(doc: TextDocument, offset: number): { line: number; column: number } {
  const at = Math.min(Math.max(offset, 0), doc.text.length)
  let low = 0
  let high = doc.lines.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (doc.lines[middle].start <= at) low = middle
    else high = middle - 1
  }
  const line = doc.lines[low]
  let column = 1
  for (let index = line.start; index < at; index++) {
    const pairedLow =
      index > line.start &&
      isLowSurrogate(doc.text.charCodeAt(index)) &&
      isHighSurrogate(doc.text.charCodeAt(index - 1))
    if (!pairedLow) column++
  }
  return { line: line.number, column }
}
