import { describe, expect, test } from "bun:test"
import { matched, reasonsOf } from "./readability.testing"

const find = (text: string, given = {}, options = {}) => matched("comma_run", text, given, options)
const why = (text: string, given = {}, options = {}) => reasonsOf("comma_run", text, given, options)

const LINKS = [
  "に",
  "は",
  "も",
  "で",
  "と",
  "が",
  "へ",
  "て",
  "ば",
  "く",
  "り",
  "ず",
  "ら",
  "から",
  "ので",
  "ため",
  "ほど",
  "くらい",
]

describe("comma_run", () => {
  test("reports three short clauses in a row that end at a comma, once, from the first clause through the last comma", () => {
    const text = "朝起きて、顔を洗って、服を着て、家を出た。"
    expect(find(text)).toEqual(["朝起きて、顔を洗って、服を着て、"])
    expect(why(text)).toEqual([
      "3 clauses of 12 characters or fewer in a row, each ending at a comma; a longer clause or two sentences may read smoother",
    ])
    expect(find("朝起きて，顔を洗って，服を着て，家を出た。")).toEqual(["朝起きて，顔を洗って，服を着て，"])
  })

  test("reports a longer run once, naming the whole run, and each run of a sentence", () => {
    expect(why("朝起きて、顔を洗って、服を着て、鞄を持って、家を出た。")[0]).toStartWith("4 clauses")
    expect(
      find(
        "朝起きて、顔を洗って、服を着て、一日の予定をゆっくりと確認してから、鞄を持って、傘を差して、靴を履いて、家を出た。",
      ),
    ).toEqual(["朝起きて、顔を洗って、服を着て、", "鞄を持って、傘を差して、靴を履いて、"])
  })

  test("needs three clauses: the text after the last comma is not one", () => {
    expect(find("朝起きて、顔を洗って、家を出た。")).toEqual([])
    expect(find("朝起きて、顔を洗って、服を着て。")).toEqual([])
  })

  test("ends a run at a clause past 12 characters", () => {
    expect(find("朝起きて、一日の予定をゆっくりと確認して、顔を洗って、服を着て、家を出た。")).toEqual([])
    expect(find("朝起きて、顔を洗って、服をてきぱきと素早く着替えて、家を出た。")).toEqual([])
    expect(find(`朝起きて、顔を洗って、${"あ".repeat(11)}て、家を出た。`)).toEqual([
      `朝起きて、顔を洗って、${"あ".repeat(11)}て、`,
    ])
    expect(find(`朝起きて、顔を洗って、${"あ".repeat(12)}て、家を出た。`)).toEqual([])
  })

  test("is quiet about a plain list, which needs two clauses that end in a particle or a conjunctive form", () => {
    expect(find("りんご、みかん、ぶどう、なし、すいかを買った。")).toEqual([])
    expect(find("りんご、みかんは、ぶどう、なし、すいかを買った。")).toEqual([])
    expect(find("りんごは、みかんも、ぶどう、なし、すいかを買った。")).toEqual(["りんごは、みかんも、ぶどう、なし、"])
    expect(find("高い、安い、速い、遅い、新しい。")).toEqual([])
  })

  test.each(LINKS)("counts a clause that ends in %s as linked", (link) => {
    expect(find(`赤${link}、青${link}、緑、黄色を買う。`)).toEqual([`赤${link}、青${link}、緑、`])
  })

  test.each(["い", "を", "の", "や", "る", "た"])("does not count a clause that ends in %s as linked", (end) => {
    expect(find(`赤${end}、青${end}、緑${end}、黄色を買う。`)).toEqual([])
  })

  test("does not count a comma inside corner brackets or parentheses", () => {
    expect(find("朝起きて、「顔を洗って、服を着て、」家を出た。")).toEqual([])
    expect(find("朝起きて、『顔を洗って、服を着て、』家を出た。")).toEqual([])
    expect(find("朝起きて、（顔を洗って、服を着て、）家を出た。")).toEqual([])
    expect(find("朝起きて、(顔を洗って、服を着て、)家を出た。")).toEqual([])
    const text = "朝起きて、顔を洗い（水で、念入り）、服を着て、家を出た。"
    expect(find(text)).toEqual(["朝起きて、顔を洗い（水で、念入り）、服を着て、"])
    expect(why(text)[0]).toStartWith("3 clauses")
  })

  test("counts a masked run as one character, and no masked run ends in a particle", () => {
    expect(find("朝起きて、`顔を洗って`、服を着て、家を出た。")).toEqual(["朝起きて、`顔を洗って`、服を着て、"])
    expect(find("朝起きて、`a`、`b`、家を出た。")).toEqual([])
    expect(find(`朝起きて、${"あ".repeat(12)}、${"い".repeat(13)}、服を着て、家を出た。`)).toEqual([])
    expect(find(`朝起きて、${"あ".repeat(12)}、服を着て、${"い".repeat(13)}、家を出た。`)).toEqual([
      `朝起きて、${"あ".repeat(12)}、服を着て、`,
    ])
  })

  test("ignores empty clauses", () => {
    expect(find("朝起きて、、顔を洗って、、服を着て、、家を出た。")).toEqual([])
  })

  test("reads each sentence on its own, across a paragraph's soft line breaks", () => {
    expect(find("朝起きて、顔を洗って。服を着て、家を出て、鞄を持った。")).toEqual([])
    expect(find("朝起きて、\n顔を洗って、\n服を着て、家を出た。")).toEqual(["朝起きて、\n顔を洗って、\n服を着て、"])
  })

  test("reads a sentence without a terminator, in a paragraph or a list item", () => {
    expect(find("朝起きて、顔を洗って、服を着て、家を出る")).toEqual(["朝起きて、顔を洗って、服を着て、"])
    expect(find("- 朝起きて、顔を洗って、服を着て、家を出る")).toEqual(["朝起きて、顔を洗って、服を着て、"])
  })

  test("does not read headings, table rows, quotations or code", () => {
    expect(find("# 朝起きて、顔を洗って、服を着て、家を出る")).toEqual([])
    expect(find("| 朝起きて、顔を洗って、服を着て、家を出る | b |\n| --- | --- |")).toEqual([])
    expect(find("> 朝起きて、顔を洗って、服を着て、家を出た。")).toEqual([])
    expect(find("```\n朝起きて、顔を洗って、服を着て、家を出た。\n```")).toEqual([])
  })

  test("is left out when exclude_rules names it", () => {
    expect(find("朝起きて、顔を洗って、服を着て、家を出た。", { exclude_rules: ["comma_run"] })).toEqual([])
  })
})
