import { MASK_CHAR, type Mask, type MaskKind } from "./model"

/** What scanning a line passes to the next: the offset where an HTML comment still open began. */
export type InlineState = { commentStart: number | null }

type Span = { start: number; end: number }

const COMMENT_OPEN = "<!--"
const COMMENT_CLOSE = "-->"
const ESCAPABLE = new Set([..."!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"])
const URL_SCHEMES = ["https://", "http://"]
const URL_TRAILING = new Set([...".,;:!?)]}'\"*_"])
const ASCII_VISIBLE_FIRST = 0x21
const ASCII_VISIBLE_LAST = 0x7e
const HTML_TAG_OPEN = /<\/?[A-Za-z]/y
const BACKTICK_RUN = /`+/g
const NOT_LINE_BREAK = /[^\r\n]/g

/** Replaces every UTF-16 unit of the spans with the mask character, keeping line breaks. The spans are sorted and never overlap. */
export function maskSpans(text: string, spans: readonly Span[]): string {
  const parts: string[] = []
  let at = 0
  for (const { start, end } of spans) {
    parts.push(text.slice(at, start), text.slice(start, end).replace(NOT_LINE_BREAK, MASK_CHAR))
    at = end
  }
  parts.push(text.slice(at))
  return parts.join("")
}

/** The start offsets of the backtick runs of a line, by run length. */
function codeRuns(line: string): Map<number, number[]> {
  const byLength = new Map<number, number[]>()
  for (const match of line.matchAll(BACKTICK_RUN)) {
    const starts = byLength.get(match[0].length) ?? []
    starts.push(match.index)
    byLength.set(match[0].length, starts)
  }
  return byLength
}

/** The offset just after the `)` that closes a link target whose `(` came just before `from`, or the line's end. */
function linkTargetEnd(line: string, from: number): number {
  let depth = 1
  let at = from
  while (at < line.length && depth > 0) {
    const char = line[at]
    if (char === "\\") {
      at += 2
      continue
    }
    if (char === "(") depth++
    else if (char === ")") depth--
    at++
  }
  return Math.min(at, line.length)
}

/** Whether the line has the end of a link text and the start of its target or reference label at `at`. */
function endsLinkText(line: string, at: number): boolean {
  return line[at] === "]" && (line[at + 1] === "(" || line[at + 1] === "[")
}

/** The offset just after the bare URL that begins at `from`, or `from` when none does. */
function bareUrlEnd(line: string, from: number): number {
  const scheme = URL_SCHEMES.find((candidate) => line.startsWith(candidate, from))
  if (scheme === undefined) return from
  const floor = from + scheme.length
  let end = floor
  while (end < line.length && !endsLinkText(line, end)) {
    const code = line.charCodeAt(end)
    if (code < ASCII_VISIBLE_FIRST || code > ASCII_VISIBLE_LAST) break
    end++
  }
  while (end > floor && URL_TRAILING.has(line[end - 1])) end--
  return end > floor ? end : from
}

/**
 * Masks the inline spans of one line (`start` to `end` of the text) into `masks`
 * and returns the line's content with them blanked. An HTML comment that does
 * not close on the line stays open in `state` for the next one.
 */
export function scanInline(text: string, start: number, end: number, state: InlineState, masks: Mask[]): string {
  const line = text.slice(start, end)
  const spans: Span[] = []
  const hide = (from: number, to: number, kind: MaskKind): void => {
    spans.push({ start: from, end: to })
    masks.push({ start: start + from, end: start + to, kind })
  }
  const runs = line.includes("`") ? codeRuns(line) : new Map<number, number[]>()
  const cursors = new Map<number, number>()
  /** The start of the next backtick run of exactly `length` at or after `from`, or -1; the offsets only grow. */
  const closerOf = (length: number, from: number): number => {
    const starts = runs.get(length)
    if (starts === undefined) return -1
    let index = cursors.get(length) ?? 0
    while (index < starts.length && starts[index] < from) index++
    cursors.set(length, index)
    return index < starts.length ? starts[index] : -1
  }

  let at = 0
  if (state.commentStart !== null) {
    const close = line.indexOf(COMMENT_CLOSE)
    if (close < 0) return MASK_CHAR.repeat(line.length)
    at = close + COMMENT_CLOSE.length
    spans.push({ start: 0, end: at })
    masks.push({ start: state.commentStart, end: start + at, kind: "comment" })
    state.commentStart = null
  }

  let unclosedTag = false
  while (at < line.length) {
    const char = line[at]
    if (char === "<") {
      if (line.startsWith(COMMENT_OPEN, at)) {
        const close = line.indexOf(COMMENT_CLOSE, at + COMMENT_OPEN.length)
        if (close < 0) {
          state.commentStart = start + at
          spans.push({ start: at, end: line.length })
          break
        }
        const to = close + COMMENT_CLOSE.length
        hide(at, to, "comment")
        at = to
        continue
      }
      HTML_TAG_OPEN.lastIndex = at
      if (!unclosedTag && HTML_TAG_OPEN.test(line)) {
        const close = line.indexOf(">", at + 1)
        if (close >= 0) {
          hide(at, close + 1, "html")
          at = close + 1
          continue
        }
        unclosedTag = true
      }
    } else if (char === "\\") {
      if (at + 1 < line.length && ESCAPABLE.has(line[at + 1])) {
        hide(at, at + 1, "escape")
        at += 2
        continue
      }
    } else if (char === "`") {
      let length = 1
      while (line[at + length] === "`") length++
      const close = closerOf(length, at + length)
      if (close >= 0) {
        hide(at, close + length, "code")
        at = close + length
      } else {
        at += length
      }
      continue
    } else if (char === "]") {
      if (line[at + 1] === "(") {
        const to = linkTargetEnd(line, at + 2)
        hide(at, to, "link_target")
        at = to
        continue
      }
      if (line[at + 1] === "[") {
        const close = line.indexOf("]", at + 2)
        const to = close < 0 ? line.length : close + 1
        hide(at, to, "link_target")
        at = to
        continue
      }
    } else if (char === "h") {
      const to = bareUrlEnd(line, at)
      if (to > at) {
        hide(at, to, "url")
        at = to
        continue
      }
    }
    at++
  }
  return maskSpans(line, spans)
}
