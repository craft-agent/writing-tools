import { MAX_EXCERPT } from "./limits"

const ELLIPSIS = "…"
const LINE_BREAK = /\r\n|\r|\n/g

/** UTF-16 units that always hold more than the code points an excerpt may show on either side of a span. */
const REACH = 2 * MAX_EXCERPT

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

/** The offset moved back onto the start of a surrogate pair it falls in the middle of. */
function pairStart(text: string, offset: number): number {
  const inside = isLowSurrogate(text.charCodeAt(offset)) && isHighSurrogate(text.charCodeAt(offset - 1))
  return inside ? offset - 1 : offset
}

/** Where a window of `width` code points goes in `length` points: centred on the span `[start, end)`, or at its start when the span is wider. */
function place(start: number, end: number, length: number, width: number): [number, number] {
  const spanWidth = end - start
  if (spanWidth >= width) return [start, Math.min(start + width, length)]
  const from = start - Math.floor((width - spanWidth) / 2)
  const first = Math.max(0, Math.min(from, length - width))
  return [first, Math.min(first + width, length)]
}

/**
 * The part of `text` that shows where a finding is: at most {@link MAX_EXCERPT}
 * code points centred on the span `[start, end)` of UTF-16 offsets, or from
 * its start when the span is wider. A line break is shown as a space and each
 * clipped end as `…`, which counts within the limit. Only the text near the
 * span is read, so a long text costs no more than a short one.
 */
export function excerptOf(text: string, start: number, end: number): string {
  const spanStart = Math.min(Math.max(start, 0), text.length)
  const from = pairStart(text, Math.max(0, spanStart - REACH))
  const spanEnd = Math.min(Math.max(end, spanStart), spanStart + REACH, text.length)
  const to = pairStart(text, Math.min(text.length, spanEnd + REACH))
  const before = Array.from(text.slice(from, spanStart))
  const inside = Array.from(text.slice(spanStart, spanEnd))
  const points = [...before, ...inside, ...Array.from(text.slice(spanEnd, to))]
  const moreBefore = from > 0
  const moreAfter = to < text.length

  for (let width = MAX_EXCERPT; width > 0; width--) {
    const [first, last] = place(before.length, before.length + inside.length, points.length, width)
    const clippedBefore = first > 0 || moreBefore
    const clippedAfter = last < points.length || moreAfter
    if (last - first + Number(clippedBefore) + Number(clippedAfter) > MAX_EXCERPT) continue
    const shown = points.slice(first, last).join("").replace(LINE_BREAK, " ")
    return `${clippedBefore ? ELLIPSIS : ""}${shown}${clippedAfter ? ELLIPSIS : ""}`
  }
  return ""
}

/** The whole of `text` when it fits within {@link MAX_EXCERPT} code points, else its start with a clipped end as `…`. */
export function leadOf(text: string): string {
  return excerptOf(text, 0, text.length)
}
