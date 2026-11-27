import { afterEach, describe, expect, test } from "bun:test"
import { fakeBridge, okReply, rawToken } from "../../engine/analyze.testing"
import { removeTempDirs } from "../../engine/engine.testing"
import { invoke } from "../../tool"
import { readDocument } from "../document"
import { inspect } from "../inspect"
import { engineOf } from "../morphology.testing"
import { writingTextRead } from "../read"
import type { TextReadInput } from "../schemas"
import { readabilityCheck } from "./readability"
import { READABILITY_TOKEN_RULES, unavailableReadability } from "./readability.tokens.testing"

afterEach(removeTempDirs)

const CTX = { cwd: process.cwd() }

const TEXT = "東京の会社の部長の名前を確認した。"

/** The call of the tests: `TEXT` inspected by the readability check, with whatever `extra` adds. */
const call = (extra: Partial<TextReadInput> = {}): TextReadInput => ({
  method: "inspect",
  text: TEXT,
  checks: ["readability"],
  ...extra,
})

describe("the rules of the readability check that read tokens, without an engine", () => {
  test("report nothing and are listed as not run", async () => {
    const report = await invoke(writingTextRead, call(), CTX)
    expect(report.findings).toEqual([])
    expect(report.not_run).toEqual(unavailableReadability(...READABILITY_TOKEN_RULES))
  })

  test("are listed one by one, and not when excluded", async () => {
    const some = await invoke(writingTextRead, call({ exclude_rules: ["no_chain", "buried_list"] }), CTX)
    expect(some.not_run).toEqual(unavailableReadability("double_negative"))
    const none = await invoke(writingTextRead, call({ exclude_rules: READABILITY_TOKEN_RULES }), CTX)
    expect(none.not_run).toEqual([])
  })

  test("leave the rules that need no tokens running", async () => {
    const report = await invoke(writingTextRead, call({ text: "朝起きて、顔を洗って、服を着て、家を出た。" }), CTX)
    expect(report.findings.map(({ rule }) => rule)).toEqual(["comma_run"])
  })
})

describe("the rules of the readability check that read tokens, with the engine's tokens", () => {
  test("report at the place of the tokens the engine gave, with their severity and reference", async () => {
    const bridge = await fakeBridge()
    const pos: NonNullable<Parameters<typeof okReply>[1]> = [
      ["名詞", "普通名詞", "一般", "*", "*", "*"],
      ["助詞", "格助詞", "*", "*", "*", "*"],
      ["動詞", "非自立可能", "*", "*", "サ行変格", "連用形-一般"],
      ["助動詞", "*", "*", "*", "助動詞-タ", "終止形-一般"],
      ["補助記号", "句点", "*", "*", "*", "*"],
    ]
    const tokens = [
      rawToken("東京", 0, 2, 0),
      rawToken("の", 2, 3, 1),
      rawToken("会社", 3, 5, 0),
      rawToken("の", 5, 6, 1),
      rawToken("部長", 6, 8, 0),
      rawToken("の", 8, 9, 1),
      rawToken("名前", 9, 11, 0),
      rawToken("を", 11, 12, 1),
      rawToken("確認", 12, 14, 0),
      rawToken("し", 14, 15, 2),
      rawToken("た", 15, 16, 3),
      rawToken("。", 16, 17, 4),
    ]
    await bridge.reply(okReply([{ tokens }], pos))
    const report = await inspect(readDocument(TEXT), call(), {}, [readabilityCheck], engineOf(bridge))
    expect(report.not_run).toEqual([])
    expect(
      report.findings.map(({ rule, severity, line, column, reference }) => [rule, severity, line, column, reference]),
    ).toEqual([["no_chain", "info", 1, 1, "readability.md#no_chain"]])
  })
})
