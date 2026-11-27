import { describe, expect, test } from "bun:test"
import { GENRES, type Genre } from "../rules"
import { matched, reasons } from "./expression.testing"

const FILLER = "この章では設定ファイルの書き方を順番に説明している。"
const ITEM = "- 設定ファイルを開く手順"

/** A paragraph of `sentences` filler sentences, 26 characters each. */
function paragraph(sentences: number): string {
  return FILLER.repeat(sentences)
}

/** The findings of one rule over a text, as rule and matched text. */
function only(rule: string, text: string, genre?: Genre): [string, string][] {
  return matched(rule, text, genre === undefined ? {} : { genre }).map((found) => [rule, found])
}

describe("bold_density", () => {
  /** Three paragraphs of 130 characters, then a line with `spans` bold spans: 411 characters with two. */
  function withBold(spans: number): string {
    const bold = ["**要点**", "**注意**", "**期限**"].slice(0, spans).join("と")
    return [paragraph(5), paragraph(5), paragraph(5), `${bold}を確認している。`].join("\n\n")
  }

  test("reports a text whose bold passes 3 per 1,000 characters, at the first bold", () => {
    expect(only("bold_density", withBold(2))).toEqual([["bold_density", "**要点**"]])
    expect(reasons(withBold(2)).filter((reason) => reason.includes("bold spans"))).toEqual([
      "2 bold spans in 411 characters, 4.87 per 1,000; more than 3 dilutes the emphasis",
    ])
  })

  test("is quiet at a lower rate", () => {
    expect(only("bold_density", withBold(1))).toEqual([])
    expect(only("bold_density", withBold(0))).toEqual([])
  })

  test("is quiet in a text of 300 characters or fewer, whatever the rate", () => {
    expect(only("bold_density", "**短い**文に**太字**が**多い**。")).toEqual([])
    expect(only("bold_density", `${paragraph(10)}**一**と**二**と**三**と**四**`)).toEqual([])
  })

  test("takes 5 per 1,000 for business and 3 for the other genres", () => {
    expect(only("bold_density", withBold(2), "business")).toEqual([])
    for (const genre of GENRES.filter((name) => name !== "business")) {
      expect(only("bold_density", withBold(2), genre)).toHaveLength(1)
    }
    expect(only("bold_density", withBold(3), "business")).toHaveLength(1)
  })

  test("counts only the bold that renders, and reads headings, lists and tables too", () => {
    const text = [paragraph(5), paragraph(5), paragraph(5), "次に**「語」**を見る。と**注意**を確認している。"].join(
      "\n\n",
    )
    expect(only("bold_density", text)).toEqual([])
    expect(only("bold_density", `${text}\n\n## **見出し**\n\n- **項目**\n`)).toEqual([["bold_density", "**注意**"]])
    expect(only("bold_density", `${text}\n\n| **列** |\n| --- |\n| **値** |\n`)).toEqual([["bold_density", "**注意**"]])
  })
})

describe("list_density", () => {
  /** `prose` lines of two filler sentences, then `items` list items. */
  function mixed(prose: number, items: number): string {
    return [...Array.from({ length: prose }, () => paragraph(2)), ...Array.from({ length: items }, () => ITEM)].join(
      "\n\n",
    )
  }

  test("reports a text where list lines are over 40% of the readable lines, at the first list line", () => {
    expect(only("list_density", mixed(5, 5))).toEqual([["list_density", "設定ファイルを開く手順"]])
    expect(reasons(mixed(5, 5)).filter((reason) => reason.includes("list items"))).toEqual([
      "5 of 10 lines (50%) are list items; more than 40% reads as notes, not as text",
    ])
  })

  test("is quiet at 40% or less of the lines, in under 10 lines, or in 300 characters or fewer", () => {
    expect(only("list_density", mixed(6, 4))).toEqual([])
    expect(only("list_density", mixed(0, 9))).toEqual([])
    expect(only("list_density", mixed(5, 5).replace(/設定ファイルを開く手順/g, "手順"))).toEqual([])
  })

  test("counts the continuation lines of an item as list lines", () => {
    const items = Array.from({ length: 3 }, () => `${ITEM}\n  続きの行です`).join("\n")
    expect(only("list_density", `${mixed(7, 0)}\n\n${items}`)).toEqual([["list_density", "設定ファイルを開く手順"]])
  })

  test("counts a table row among the readable lines", () => {
    const rows = Array.from({ length: 6 }, () => `| ${paragraph(2)} |`).join("\n")
    expect(only("list_density", `${mixed(2, 5)}\n\n| 列 |\n| --- |\n${rows}`)).toEqual([])
  })

  test("runs for general and essay text, and is off for technical and business text", () => {
    expect(only("list_density", mixed(5, 5), "general")).toHaveLength(1)
    expect(only("list_density", mixed(5, 5), "essay")).toHaveLength(1)
    expect(only("list_density", mixed(5, 5), "technical")).toEqual([])
    expect(only("list_density", mixed(5, 5), "business")).toEqual([])
  })
})
