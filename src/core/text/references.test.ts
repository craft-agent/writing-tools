import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "bun:test"
import { CHECK_SPECS } from "./registry"

const REFERENCES_DIR = fileURLToPath(new URL("../../../skills/japanese-writing/references/", import.meta.url))

const RULES = CHECK_SPECS.flatMap((spec) => spec.rules)

/** A `###` heading that names one rule: its id in backticks and nothing else. */
const RULE_HEADING = /^`([^`]+)`$/

/** Every heading of a Markdown text: its level and its text. Fenced code is not read. */
function headingsOf(markdown: string): { level: number; text: string }[] {
  let fenced = false
  const headings: { level: number; text: string }[] = []
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const match = fenced ? null : /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (match !== null) headings.push({ level: match[1].length, text: match[2] })
  }
  return headings
}

/** The anchors GitHub gives the headings: lowercase, punctuation other than `-` and `_` removed, spaces as `-`, a repeat numbered. */
function anchorsOf(headings: readonly { text: string }[]): string[] {
  const seen = new Map<string, number>()
  return headings.map(({ text }) => {
    const anchor = text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
      .replace(/\s/g, "-")
    const count = seen.get(anchor) ?? 0
    seen.set(anchor, count + 1)
    return count === 0 ? anchor : `${anchor}-${count}`
  })
}

const FILES = readdirSync(REFERENCES_DIR).filter((name) => name.endsWith(".md"))
const HEADINGS = new Map(
  FILES.map((name) => [name, headingsOf(readFileSync(join(REFERENCES_DIR, name), "utf8"))] as const),
)

describe("the anchors of a heading", () => {
  test("follow GitHub's rule", () => {
    const anchors = anchorsOf([
      { text: "`latin_spacing`" },
      { text: "Notes: A (B) c" },
      { text: "和文と英数字のあいだの空白" },
      { text: "Notes: A (B) c" },
    ])
    expect(anchors).toEqual(["latin_spacing", "notes-a-b-c", "和文と英数字のあいだの空白", "notes-a-b-c-1"])
  })

  test("are read from headings outside fenced code only", () => {
    expect(headingsOf("# One\n```text\n# not a heading\n```\n### `two` ##\n")).toEqual([
      { level: 1, text: "One" },
      { level: 3, text: "`two`" },
    ])
  })
})

describe("the skill's references", () => {
  test("hold a file and an anchor for the reference of every rule", () => {
    const missing = RULES.flatMap(({ id, reference }) => {
      const [file, anchor = ""] = reference.split("#")
      const headings = HEADINGS.get(file)
      return headings !== undefined && anchorsOf(headings).includes(anchor) ? [] : [`${id}: ${reference}`]
    })
    expect(missing).toEqual([])
  })

  test("have a `###` section named by its id for every rule of the notation check", () => {
    for (const { id, reference } of RULES.filter(({ check }) => check === "notation")) {
      expect(reference).toBe(`notation.md#${id}`)
      const sections = HEADINGS.get("notation.md")?.filter(({ level }) => level === 3) ?? []
      expect(sections.map(({ text }) => text)).toContain(`\`${id}\``)
    }
  })

  test("have no `###` section for a rule that does not exist", () => {
    const ids = new Set(RULES.map(({ id }) => id))
    const stale = [...HEADINGS].flatMap(([file, headings]) =>
      headings
        .filter(({ level }) => level === 3)
        .flatMap(({ text }) => RULE_HEADING.exec(text)?.[1] ?? [])
        .filter((id) => !ids.has(id))
        .map((id) => `${file}: ${id}`),
    )
    expect(stale).toEqual([])
  })
})
