import { describe, expect, test } from "bun:test"
import { hits, reasons, run } from "./expression.testing"

describe("register held to the document", () => {
  test("draws nothing from a text that is polite or plain throughout, and settles it", () => {
    const polite = "手順を確認します。結果を共有します。"
    const plain = "手順を確認する。結果を共有する。"
    expect(hits(polite)).toEqual([])
    expect(hits(plain)).toEqual([])
    expect(run(polite).settled?.register).toBe("polite")
    expect(run(plain).settled?.register).toBe("plain")
    expect(run("確認手順の一覧。").settled).toBeUndefined()
  })

  test("reports each sentence of the minority, naming the majority and the counts", () => {
    const text = "確認します。実行します。停止する。"
    expect(hits(text)).toEqual([["register", "る。"]])
    expect(reasons(text)).toEqual(["plain here; the text mostly uses polite (2 to 1)"])
    expect(run(text).settled?.register).toBe("polite")
  })

  test("takes the register that comes first as the majority on a tie", () => {
    expect(hits("確認します。停止する。")).toEqual([["register", "る。"]])
    expect(hits("停止する。確認します。")).toEqual([["register", "ます。"]])
  })

  test("spans the ending through the terminator, closing marks and notes included", () => {
    const given = { register: "polite" }
    expect(hits("これは本である。", given)).toEqual([["register", "である。"]])
    expect(hits("彼は「行く」。", given)).toEqual([["register", "く」。"]])
    expect(hits("確認する（注）。", given)).toEqual([["register", "る（注）。"]])
    expect(hits("**確認する**！", given)).toEqual([["register", "る**！"]])
    expect(hits("確認する?", given)).toEqual([["register", "る?"]])
    expect(hits("確認\nする。", given)).toEqual([["register", "る。"]])
  })

  test("reads the wording before the terminator, so a quotation inside a sentence is not its ending", () => {
    const given = { register: "polite" }
    expect(hits("彼は「確認します。」と言った。", given)).toEqual([["register", "た。"]])
    expect(hits("彼は「確認します」。", { register: "plain" })).toEqual([["register", "ます」。"]])
  })

  test("leaves out masked text", () => {
    expect(hits("`確認する。`です。", { register: "plain" })).toEqual([["register", "です。"]])
    expect(hits("確認します。\n\n```\n停止する。\n```\n")).toEqual([])
  })
})

describe("register held to a value", () => {
  test("reports every sentence of the other register, naming the argument or the setting", () => {
    const text = "確認します。停止する。実行した。"
    expect(hits(text, { register: "polite" })).toEqual([
      ["register", "る。"],
      ["register", "た。"],
    ])
    expect(reasons(text, { register: "polite" })[0]).toBe("uses plain where the argument expects polite")
    expect(reasons(text, {}, { register: "plain" })).toEqual(["uses polite where the setting expects plain"])
  })

  test("settles nothing, and lets the argument win over the setting", () => {
    expect(run("確認します。停止する。", { register: "polite" }).settled).toBeUndefined()
    expect(hits("確認します。停止する。", { register: "plain" }, { register: "polite" })).toEqual([
      ["register", "ます。"],
    ])
  })

  test("takes every other sentence, however few use the value", () => {
    expect(hits("確認します。", { register: "plain" })).toEqual([["register", "ます。"]])
  })
})

describe("the sentences register counts", () => {
  const given = { register: "polite" }

  test("counts body text and list items that end in a terminator", () => {
    expect(hits("確認する。\n\n- 停止する。\n- 実行する!\n1. 開始する？", given)).toEqual([
      ["register", "る。"],
      ["register", "る。"],
      ["register", "る!"],
      ["register", "る？"],
    ])
  })

  test("never counts a heading, a table, a quotation or a list item without a terminator", () => {
    const text = "# 確認する。\n\n| 確認する。 |\n| --- |\n\n> 確認する。\n\n- 停止する\n- 設定を開く\n"
    expect(hits(text, given)).toEqual([])
    expect(run(text).settled).toBeUndefined()
  })

  test("never counts a noun ending, an ending in a particle or a lone terminator", () => {
    expect(hits("確認手順の一覧。確認しますが。。", given)).toEqual([])
    expect(hits("確認手順の一覧。確認する。", given)).toEqual([["register", "る。"]])
  })

  test("never counts a final sentence without a terminator", () => {
    expect(hits("確認します。停止する", given)).toEqual([])
    expect(run("確認します。停止する").settled?.register).toBe("polite")
  })
})

describe("register as a rule", () => {
  test("is neither run nor settled once excluded", () => {
    const result = run("確認します。停止する。", { exclude_rules: ["register"] })
    expect(result.findings).toEqual([])
    expect(result.settled).toBeUndefined()
  })
})
