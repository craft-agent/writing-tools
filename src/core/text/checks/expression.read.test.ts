import { describe, expect, test } from "bun:test"
import { invoke } from "../../tool"
import { writingTextRead } from "../read"

const CTX = { cwd: process.cwd() }

/** A text that draws every rule of the formatting, rhythm and stance groups once, and none of the others: all its sentences are about 15 characters long. */
const TEXT = [
  "# 運用の決まり",
  "",
  "今日は予算の会議を開きます。議題は三つに絞って進めます。最初に費用の見直しを行います。",
  "",
  "朝の八時に急いで家を出ました。電車は思ったより空いています。端の席には誰も座っていません。かばんから本を取り出して開きました。",
  "",
  "次に**「文書の立場」**を決めます。",
  "",
  "週に一度は内容を見直しましょう。",
  "",
  "- **期限**は月末までに全体へ共有する",
  "- 予算の見直しは担当者が一覧にまとめる",
  "- 会議の議事録は当日中に全員へ送る",
  "- **担当**は各チームの代表者が決める",
  "- 費用の増減は理由を添えて記録に残す",
  "- 議題の候補は前日までに募って集める",
  "- 決まらなかった項目は次回へ持ち越す",
  "- 持ち越した項目は先頭に置いて確認する",
  "- 会議の資料は前の晩までに共有の場所へ置く",
  "- 参加できない人には要点を文書で知らせる",
  "- 決定事項は議事録の冒頭に箇条書きで記す",
  "- 次回の日程は会議の終わりに全員で決める",
].join("\n")

describe("writing_text_read with the formatting, rhythm and stance rules", () => {
  test("reports each rule with its reference, at the place it concerns", async () => {
    const report = await invoke(writingTextRead, { method: "inspect", text: TEXT, stance: "rule" }, CTX)
    expect(
      report.findings.map(({ rule, severity, line, column, reference }) => [rule, severity, line, column, reference]),
    ).toEqual([
      ["uniform_sentence_length", "info", 3, 1, "expression.md#uniform_sentence_length"],
      ["ending_repetition", "info", 3, 41, "expression.md#ending_repetition"],
      ["choppy_sentences", "info", 5, 1, "expression.md#choppy_sentences"],
      ["bold_not_rendered", "critical", 7, 3, "expression.md#bold_not_rendered"],
      ["stance_ending", "warn", 9, 12, "expression.md#stance_ending"],
      ["bold_density", "info", 11, 3, "expression.md#bold_density"],
      ["list_density", "info", 11, 3, "expression.md#list_density"],
    ])
    expect(report.counts.by_check.expression).toEqual({ critical: 1, warn: 1, info: 5 })
    expect(report.not_run).toEqual([])
  })

  test("says why", async () => {
    const report = await invoke(writingTextRead, { method: "inspect", text: TEXT, stance: "rule" }, CTX)
    expect(report.findings.map(({ reason }) => reason)).toEqual([
      "sentence lengths vary little: a coefficient of variation of 0.10 over 9 sentences of 15.7 characters on average",
      '3 sentences in a row end in "ます"',
      "4 short sentences in a row, each within 22 characters, or 38 when no comma follows a connective",
      'the opening ** follows "に" and precedes "「", so it does not open bold; move "「" outside the bold, or put a space before **; ' +
        'the closing ** follows "」" and precedes "を", so it does not close bold; move "」" outside the bold, or put a space after **',
      'a recommendation in a rule: the sentence ends in "ましょう"',
      "2 bold spans in 365 characters, 5.48 per 1,000; more than 3 dilutes the emphasis",
      "12 of 17 lines (71%) are list items; more than 40% reads as notes, not as text",
    ])
  })

  test("leaves out the stance rule without a stance, and the list rule for technical text", async () => {
    const plain = await invoke(writingTextRead, { method: "inspect", text: TEXT }, CTX)
    expect(plain.findings.map(({ rule }) => rule)).not.toContain("stance_ending")
    expect(plain.not_run).toEqual([])
    const technical = await invoke(writingTextRead, { method: "inspect", text: TEXT, genre: "technical" }, CTX)
    expect(technical.findings.map(({ rule }) => rule)).not.toContain("list_density")
    expect(technical.findings.map(({ rule }) => rule)).toContain("bold_density")
    expect(technical.not_run).toEqual([])
  })
})
