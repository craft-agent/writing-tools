import type { Block, Line } from "./model"

/** Whether a line extends the block of the line before it, which has the same kind. */
function continuesBlock(line: Line, itemStarts: ReadonlySet<number>): boolean {
  switch (line.kind) {
    case "prose":
    case "quote":
      return true
    case "list":
      return !itemStarts.has(line.number)
    default:
      return false
  }
}

/**
 * Groups the lines into blocks: consecutive prose lines, a list item with its
 * continuation lines and consecutive quote lines each make one block; a
 * heading and a table row are one block each. An excluded line ends a block.
 */
export function buildBlocks(lines: readonly Line[], itemStarts: ReadonlySet<number>): Block[] {
  const blocks: Block[] = []
  let open: { kind: Block["kind"]; first: Line; last: Line; numbers: number[] } | null = null
  const close = (): void => {
    if (open === null) return
    blocks.push({ kind: open.kind, start: open.first.contentStart, end: open.last.contentEnd, lines: open.numbers })
    open = null
  }
  for (const line of lines) {
    if (line.kind === "excluded") {
      close()
      continue
    }
    if (open !== null && open.kind === line.kind && continuesBlock(line, itemStarts)) {
      open.last = line
      open.numbers.push(line.number)
      continue
    }
    close()
    open = { kind: line.kind, first: line, last: line, numbers: [line.number] }
  }
  close()
  return blocks
}
