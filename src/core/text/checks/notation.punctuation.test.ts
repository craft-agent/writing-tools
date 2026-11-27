import { describe, expect, test } from "bun:test"
import { hits, reasons, run } from "./notation.testing"

const settled = (text: string) => run(text).settled?.punctuation

describe("punctuation held to a value", () => {
  test("ten_maru allows 、。 and reports ，．", () => {
    expect(hits("私は、彼女，と．話した。", { punctuation: "ten_maru" })).toEqual([
      ["punctuation", "，"],
      ["punctuation", "．"],
    ])
    expect(reasons("私は，", { punctuation: "ten_maru" })).toEqual(['"，" where the argument expects ten_maru (、。)'])
  })

  test("comma_period allows ，． and reports 、。", () => {
    expect(hits("私は、彼女，と．話した。", { punctuation: "comma_period" })).toEqual([
      ["punctuation", "、"],
      ["punctuation", "。"],
    ])
  })

  test("comma_maru allows ，。 and reports 、．, naming the setting", () => {
    expect(hits("私は、彼女，と．話した。", {}, { punctuation: "comma_maru" })).toEqual([
      ["punctuation", "、"],
      ["punctuation", "．"],
    ])
    expect(reasons("私は、", {}, { punctuation: "comma_maru" })).toEqual([
      '"、" where the setting expects comma_maru (，。)',
    ])
  })

  test("never counts a ． or ， between digits", () => {
    expect(hits("円周率は３．１４、3．14、１，０００円。", { punctuation: "ten_maru" })).toEqual([])
    expect(hits("1。2とx．4", { punctuation: "comma_period" })).toEqual([["punctuation", "。"]])
    expect(hits("1。2とx．4", { punctuation: "ten_maru" })).toEqual([["punctuation", "．"]])
  })
})

describe("punctuation held to the document", () => {
  test("draws nothing from a text that is consistent in any listed value", () => {
    expect(hits("私は、彼女と話した。そして、帰った。")).toEqual([])
    expect(hits("私は，彼女と話した．そして，帰った．")).toEqual([])
    expect(hits("私は，彼女と話した。そして，帰った。")).toEqual([])
  })

  test("reports the minority mark of each kind, naming the majority and the counts", () => {
    const text = "私は、彼女と、話し，帰った。そして．寝た。また。"
    expect(hits(text)).toEqual([
      ["punctuation", "，"],
      ["punctuation", "．"],
    ])
    expect(reasons(text)).toEqual([
      '"，" here; the text mostly uses "、" (2 to 1)',
      '"．" here; the text mostly uses "。" (3 to 1)',
    ])
  })

  test("takes the mark that occurs first as the majority on a tie", () => {
    expect(hits("私は，彼女は、")).toEqual([["punctuation", "、"]])
  })

  test("settles the value only when one listed value writes both majorities", () => {
    expect(settled("私は、彼女と話した。")).toBe("ten_maru")
    expect(settled("私は，彼女と話した．")).toBe("comma_period")
    expect(settled("私は，彼女と話した。")).toBe("comma_maru")
    expect(settled("私は、彼女と、話し，帰った。")).toBe("ten_maru")
  })

  test("leaves a majority that fits no value, or two values, unset, and still reports the minority", () => {
    expect(settled("私は、彼女と話した．")).toBeUndefined()
    expect(settled("彼女と話した。")).toBeUndefined()
    expect(settled("私は，彼女と，話した")).toBeUndefined()
    expect(settled("私は")).toBeUndefined()
    expect(hits("私は、彼女と、話し，帰った．")).toEqual([["punctuation", "，"]])
  })

  test("settles nothing when an argument or a setting holds the value", () => {
    expect(run("私は、彼女と話した。", { punctuation: "ten_maru" }).settled).toBeUndefined()
  })
})
