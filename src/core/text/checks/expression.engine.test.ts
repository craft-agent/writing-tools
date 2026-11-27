import { afterEach, describe, expect, test } from "bun:test"
import { fakeBridge, okReply, rawToken } from "../../engine/analyze.testing"
import { removeTempDirs } from "../../engine/engine.testing"
import { invoke } from "../../tool"
import { readDocument } from "../document"
import { inspect } from "../inspect"
import { engineOf } from "../morphology.testing"
import { writingTextRead } from "../read"
import type { TextReadInput } from "../schemas"
import { expressionCheck } from "./expression"
import { TOKEN_RULES, unavailable } from "./expression.tokens.testing"
import { ALL_TOKEN_RULES_NOT_RUN, READABILITY_TOKEN_RULES, unavailableReadability } from "./readability.tokens.testing"

afterEach(removeTempDirs)

const CTX = { cwd: process.cwd() }

const TEXT = "この事実は課題を示す。"

/** The call of the tests: `TEXT` inspected with whatever `extra` adds. */
const call = (extra: Partial<TextReadInput> = {}): TextReadInput => ({ method: "inspect", text: TEXT, ...extra })

describe("the rules that read tokens, without an engine", () => {
  test("report nothing and are listed as not run, the rule that is off by default only when `rules` names it", async () => {
    const plain = await invoke(writingTextRead, call(), CTX)
    expect(plain.findings).toEqual([])
    expect(plain.not_run).toEqual(ALL_TOKEN_RULES_NOT_RUN)
    const named = await invoke(writingTextRead, call({ rules: ["inanimate_subject"] }), CTX)
    expect(named.findings).toEqual([])
    expect(named.not_run).toEqual([
      ...unavailable(...TOKEN_RULES, "inanimate_subject"),
      ...unavailableReadability(...READABILITY_TOKEN_RULES),
    ])
  })

  test("are not listed when excluded, or when their check is not asked for", async () => {
    const excluded = call({ exclude_rules: [...TOKEN_RULES, ...READABILITY_TOKEN_RULES] })
    expect((await invoke(writingTextRead, excluded, CTX)).not_run).toEqual([])
    const notation = call({ checks: ["notation"] })
    expect((await invoke(writingTextRead, notation, CTX)).not_run).toEqual([])
  })

  test("are not listed for a text with no paragraph or list item to read", async () => {
    const heading = call({ text: "# 見出し" })
    expect((await invoke(writingTextRead, heading, CTX)).not_run).toEqual([])
  })
})

describe("the rules that read tokens, with the engine's tokens", () => {
  test("report at the place of the tokens the engine gave", async () => {
    const bridge = await fakeBridge()
    const pos: NonNullable<Parameters<typeof okReply>[1]> = [
      ["連体詞", "*", "*", "*", "*", "*"],
      ["名詞", "普通名詞", "一般", "*", "*", "*"],
      ["助詞", "係助詞", "*", "*", "*", "*"],
      ["動詞", "一般", "*", "*", "五段-サ行", "終止形-一般"],
      ["補助記号", "句点", "*", "*", "*", "*"],
    ]
    const tokens = [
      rawToken("この", 0, 2, 0),
      rawToken("事実", 2, 4, 1),
      rawToken("は", 4, 5, 2),
      rawToken("課題", 5, 7, 1),
      rawToken("を", 7, 8, 2),
      rawToken("示す", 8, 10, 3),
      rawToken("。", 10, 11, 4),
    ]
    await bridge.reply(okReply([{ tokens }], pos))
    const report = await inspect(
      readDocument(TEXT),
      call({ rules: ["inanimate_subject"] }),
      {},
      [expressionCheck],
      engineOf(bridge),
    )
    expect(report.not_run).toEqual([])
    expect(
      report.findings.map(({ rule, severity, line, column, excerpt, reference }) => [
        rule,
        severity,
        line,
        column,
        excerpt,
        reference,
      ]),
    ).toEqual([["inanimate_subject", "info", 1, 1, TEXT, "expression.md#inanimate_subject"]])
  })
})
