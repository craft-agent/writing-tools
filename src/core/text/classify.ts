import { scanInline, type InlineState } from "./inline"
import type { Line, LineKind, Mask } from "./model"

/** The offsets of a line's content, its line break excluded. */
export type LineRange = { start: number; end: number }

/** The lines of a text with their kinds, the masks the block structure found, and the numbers of the lines that open a list item. */
export type Classified = { lines: Line[]; masks: Mask[]; itemStarts: Set<number> }

type Fence = { char: string; length: number }
type OpenList = { indent: number; blank: boolean }

const TAB_WIDTH = 4
/** A line indented this far past its container is indented code. */
const CODE_INDENT = 4
/** A list marker followed by this many spaces or more starts its content one column after the marker. */
const LONG_MARKER_GAP = 5
const FRONT_MATTER_FENCE = "---"
const FRONT_MATTER_CLOSERS = [FRONT_MATTER_FENCE, "..."]

const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE = /^[ \t]*(`{3,}|~{3,})[ \t]*$/
const QUOTE = /^ {0,3}>/
const QUOTE_MARKER = /^ {0,3}(?:>[ \t]?)+/
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+|$)/
const LIST_MARKER = /^[ \t]*(?:[-+*]|\d{1,9}[.)])(?:[ \t]+|$)/
const TASK_BOX = /^\[[ xX]\](?:[ \t]+|$)/
const THEMATIC = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/
const REFERENCE_DEFINITION = /^ {0,3}\[(?!\^)[^\]]+\]:/
const TABLE_DELIMITER_CELL = /^\s*:?-{3,}:?\s*$/
const BLANK = /^[ \t\u0000]*$/
const NOT_BLANK = /[^ \t]/

/** The display column after `text`, a tab reaching the next multiple of {@link TAB_WIDTH}. */
function columnAfter(text: string): number {
  let column = 0
  for (let at = 0; at < text.length; at++) column += text[at] === "\t" ? TAB_WIDTH - (column % TAB_WIDTH) : 1
  return column
}

function indentOf(raw: string): number {
  return columnAfter(/^[ \t]*/.exec(raw)![0])
}

function isSpace(char: string): boolean {
  return char === " " || char === "\t"
}

/** The fence an opening line starts. A backtick fence's info string holds no backtick. */
function fenceOf(raw: string): Fence | null {
  const match = FENCE_OPEN.exec(raw)
  if (match === null || (match[1][0] === "`" && match[2].includes("`"))) return null
  return { char: match[1][0], length: match[1].length }
}

function closesFence(raw: string, fence: Fence): boolean {
  const match = FENCE_CLOSE.exec(raw)
  return match !== null && match[1][0] === fence.char && match[1].length >= fence.length
}

/** The index of the line that closes the front matter the text opens with, or -1 when there is none. */
function frontMatterEnd(text: string, ranges: readonly LineRange[]): number {
  const lineAt = (index: number): string => text.slice(ranges[index].start, ranges[index].end).trimEnd()
  if (lineAt(0) !== FRONT_MATTER_FENCE) return -1
  for (let index = 1; index < ranges.length; index++) {
    if (FRONT_MATTER_CLOSERS.includes(lineAt(index))) return index
  }
  return -1
}

function isDelimiterRow(masked: string): boolean {
  const trimmed = masked.trim()
  const piped = trimmed.length > 1 && trimmed.startsWith("|") && trimmed.endsWith("|")
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "")
  const cells = inner.split("|")
  return (cells.length >= 2 || piped) && cells.every((cell) => TABLE_DELIMITER_CELL.test(cell))
}

/** The offset where a heading's content ends: before its closing hashes, which a space must set apart, and trailing spaces. */
function headingContentEnd(masked: string, from: number): number {
  let end = masked.length
  while (end > from && isSpace(masked[end - 1])) end--
  let hashes = end
  while (hashes > from && masked[hashes - 1] === "#") hashes--
  if (hashes < end && (hashes === from || isSpace(masked[hashes - 1]))) {
    end = hashes
    while (end > from && isSpace(masked[end - 1])) end--
  }
  return end
}

/** The list a marker opens: the column its content starts at. */
function listOf(marker: string): OpenList {
  const gap = marker.length - marker.trimEnd().length
  const content = gap > 0 && gap < LONG_MARKER_GAP ? marker : marker.trimEnd() + " "
  return { indent: columnAfter(content), blank: false }
}

/** Gives a prose line the kind and content range of a line a later line turns into a heading or a table row. */
function retag(line: Line, raw: string, kind: LineKind, level?: number): void {
  line.kind = kind
  line.contentStart = line.start + /^[ \t]*/.exec(raw)![0].length
  line.contentEnd = line.start + raw.trimEnd().length
  if (level !== undefined) line.level = level
}

/**
 * Gives every line of the text its kind, and finds the masks that belong to the
 * block structure: front matter, code blocks, reference definitions and HTML
 * comments, with the inline ones of the lines that are read.
 */
export function classifyLines(text: string, ranges: readonly LineRange[]): Classified {
  const lines: Line[] = []
  const masks: Mask[] = []
  const itemStarts = new Set<number>()
  const inline: InlineState = { commentStart: null }
  const maskedLines: string[] = []
  const frontEnd = frontMatterEnd(text, ranges)
  let fence: Fence | null = null
  let fenceStart = 0
  let quoteOpen = false
  let list: OpenList | null = null
  let inTable = false

  for (let index = 0; index < ranges.length; index++) {
    const { start, end } = ranges[index]
    const raw = text.slice(start, end)
    const previous: Line | undefined = lines[index - 1]
    const inComment = inline.commentStart !== null
    const wasTable = inTable
    inTable = false
    maskedLines.push("")

    const add = (kind: LineKind, contentStart = start, contentEnd = end, level?: number): void => {
      lines.push({ number: index + 1, start, end, kind, contentStart, contentEnd, ...(level ? { level } : {}) })
    }
    const indent = indentOf(raw)
    const contentFrom = start + /^[ \t]*/.exec(raw)![0].length

    if (index <= frontEnd) {
      if (index === frontEnd) masks.push({ start: 0, end, kind: "front_matter" })
      add("excluded")
      continue
    }
    if (fence !== null) {
      if (closesFence(raw, fence)) {
        masks.push({ start: fenceStart, end, kind: "code_block" })
        fence = null
      }
      add("excluded")
      continue
    }

    if (!inComment) {
      if (QUOTE.test(raw)) {
        const marker = QUOTE_MARKER.exec(raw)![0].length
        const masked = scanInline(text, start, end, inline, masks)
        maskedLines[index] = masked
        if (list !== null && indent < list.indent) list = null
        quoteOpen = !BLANK.test(masked.slice(marker))
        if (quoteOpen) add("quote", start + marker)
        else add("excluded")
        continue
      }
      if (!NOT_BLANK.test(raw)) {
        quoteOpen = false
        if (list !== null) list.blank = true
        add("excluded")
        continue
      }
      if (quoteOpen && !ATX.test(raw) && !LIST_MARKER.test(raw) && !THEMATIC.test(raw) && fenceOf(raw) === null) {
        const masked = scanInline(text, start, end, inline, masks)
        maskedLines[index] = masked
        quoteOpen = !BLANK.test(masked)
        if (quoteOpen) add("quote", contentFrom)
        else add("excluded")
        continue
      }
      quoteOpen = false
      const opening = fenceOf(raw)
      if (opening !== null && indent - (list !== null && indent >= list.indent ? list.indent : 0) < CODE_INDENT) {
        if (list !== null && indent < list.indent) list = null
        fence = opening
        fenceStart = start
        add("excluded")
        continue
      }
      if (indent >= (list?.indent ?? 0) + CODE_INDENT) {
        masks.push({ start, end, kind: "code_block" })
        add("excluded")
        continue
      }
      const marker = LIST_MARKER.exec(raw)
      const inner = marker === null ? null : fenceOf(raw.slice(marker[0].length))
      if (marker !== null && inner !== null) {
        list = listOf(marker[0])
        fence = inner
        fenceStart = start + marker[0].length
        add("excluded")
        continue
      }
      if (REFERENCE_DEFINITION.test(raw)) {
        masks.push({ start, end, kind: "link_target" })
        add("excluded")
        continue
      }
    }

    const masked = scanInline(text, start, end, inline, masks)
    maskedLines[index] = masked
    if (BLANK.test(masked)) {
      add("excluded")
      continue
    }
    if (previous?.kind === "prose" && maskedLines[index - 1].includes("|") && isDelimiterRow(masked)) {
      retag(previous, text.slice(previous.start, previous.end), "table")
      inTable = true
      add("excluded")
      continue
    }
    if (SETEXT.test(masked) && previous?.kind === "prose") {
      retag(previous, text.slice(previous.start, previous.end), "heading", masked.includes("=") ? 1 : 2)
      list = null
      add("excluded")
      continue
    }
    if (THEMATIC.test(masked)) {
      list = null
      add("excluded")
      continue
    }
    const item = LIST_MARKER.exec(masked)
    if (item !== null) {
      const task = TASK_BOX.exec(masked.slice(item[0].length))
      list = listOf(item[0])
      itemStarts.add(index + 1)
      add("list", start + item[0].length + (task?.[0].length ?? 0))
      continue
    }
    const heading = ATX.exec(masked)
    if (heading !== null) {
      list = null
      add("heading", start + heading[0].length, start + headingContentEnd(masked, heading[0].length), heading[1].length)
      continue
    }
    if (wasTable && masked.includes("|")) {
      inTable = true
      add("table", contentFrom)
      continue
    }
    if (list !== null && (indent >= list.indent || !list.blank)) {
      list.blank = false
      add("list", contentFrom)
      continue
    }
    list = null
    add("prose")
  }

  if (fence !== null) masks.push({ start: fenceStart, end: text.length, kind: "code_block" })
  if (inline.commentStart !== null) masks.push({ start: inline.commentStart, end: text.length, kind: "comment" })
  return { lines, masks, itemStarts }
}
