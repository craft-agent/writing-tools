import { describe, expect, test } from "bun:test"
import { matched, reasonsOf } from "./expression.testing"
import type { Genre } from "../rules"

const ON = { rules: ["contrast_overuse", "emoji"] }

/** A sentence with no contrast construction, no emoji and no phrase of the other rules. */
const PLAIN = "朝に家を出る。"

/** `count` sentences, the first `contrasts` of them with `ではなく`. */
function sentences(count: number, contrasts: number): string {
  return Array.from({ length: count }, (_, index) => (index < contrasts ? "速さではなく正確さを選ぶ。" : PLAIN)).join(
    "",
  )
}

describe("contrast_overuse", () => {
  const find = (text: string, genre?: Genre) =>
    matched("contrast_overuse", text, { ...ON, ...(genre === undefined ? {} : { genre }) })

  test("is off by default, and reports once `rules` names it", () => {
    expect(matched("contrast_overuse", sentences(10, 5))).toEqual([])
    expect(find(sentences(10, 5))).toEqual(["ではなく"])
  })

  test("reports once, at the first construction, with the count and the rate", () => {
    expect(reasonsOf("contrast_overuse", sentences(20, 4), ON)).toEqual([
      "4 contrast constructions in 20 sentences, 0.20 per sentence; 0.05 or more reads as a habit",
    ])
    expect(find(`${PLAIN}${sentences(20, 4)}`)).toEqual(["ではなく"])
  })

  test("counts each construction of the list", () => {
    const text = "速さではなく正確さを選ぶ。速いだけでなく安全も守る。急ぐわけではありません。急ぐというよりは待つ。"
    expect(find(text)).toEqual(["ではなく"])
    expect(reasonsOf("contrast_overuse", text, ON)[0]).toStartWith("4 contrast constructions in 4 sentences")
    expect(find("速いだけではなく安全も守る。")).toEqual([])
    expect(reasonsOf("contrast_overuse", `${text}速いだけではなく安全だ。`, ON)[0]).toStartWith("5 contrast")
  })

  test("needs a も after だけでなく, and わけでは with ない", () => {
    const text = "速いだけでなく安全だ。急ぐわけではあるが待つ。速いだけでなく安全だ。速いだけでなく安全だ。"
    expect(reasonsOf("contrast_overuse", text, ON)).toEqual([])
    expect(reasonsOf("contrast_overuse", "速いだけでなく安全も守る。".repeat(3), ON)).toHaveLength(1)
  })

  test("is quiet under three constructions, whatever the rate", () => {
    expect(find("速さではなく正確さを選ぶ。急ぐというより待つ。")).toEqual([])
    expect(find(sentences(100, 2))).toEqual([])
    expect(find(sentences(3, 3))).toHaveLength(1)
  })

  test("takes 0.05 a sentence for most genres and 0.08 for technical text", () => {
    expect(find(sentences(60, 3))).toEqual(["ではなく"])
    expect(find(sentences(61, 3))).toEqual([])
    for (const genre of ["general", "business", "essay"] as const) {
      expect(find(sentences(60, 3), genre)).toHaveLength(1)
    }
    expect(find(sentences(60, 3), "technical")).toEqual([])
    expect(find(sentences(37, 3), "technical")).toHaveLength(1)
    expect(find(sentences(38, 3), "technical")).toEqual([])
  })

  test("counts the sentences of body text and list items, and the constructions of every readable line", () => {
    expect(find(`${sentences(30, 3)}\n\n> ${sentences(100, 0)}`)).toEqual(["ではなく"])
    expect(find(`# 速さではなく正確さ\n\n- 急ぐというより待つ\n\n${sentences(30, 1)}`)).toEqual(["ではなく"])
  })

  test("never matches masked text or a quotation", () => {
    const quoted = Array.from({ length: 4 }, () => "> 速さではなく正確さを選ぶ。").join("\n")
    expect(find(`${PLAIN}\n\n${quoted}`)).toEqual([])
    expect(find(`\`ではなく\`と書く。${PLAIN}`.repeat(4))).toEqual([])
  })
})

describe("emoji", () => {
  const find = (text: string) => matched("emoji", text, ON)

  test("is off by default, and reports once `rules` names it", () => {
    expect(matched("emoji", "完了です🎉")).toEqual([])
    expect(find("完了です🎉")).toEqual(["🎉"])
    expect(reasonsOf("emoji", "完了です🎉", ON)).toEqual(['an emoji sets a tone; "🎉" may be left out'])
  })

  test("reports a run of consecutive emoji once, and each separate run", () => {
    expect(find("やった🎉🔥✨ 次は🚀。")).toEqual(["🎉🔥✨", "🚀"])
    expect(find("🎉 🎉")).toEqual(["🎉", "🎉"])
  })

  test("holds a sequence together: variation selector, skin tone, joiner", () => {
    expect(find("注意⚠️です。")).toEqual(["⚠️"])
    expect(find("手を振る👋🏽。")).toEqual(["👋🏽"])
    expect(find("家族👨‍👩‍👧です。")).toEqual(["👨‍👩‍👧"])
  })

  test("takes a symbol shown as text by default only with the variation selector", () => {
    expect(find("↔ ✔ ▶ ‼ ℹ ☑ ♥ ☺")).toEqual([])
    expect(find("✔️ ▶️ ♥️ ☺️ ↔️")).toEqual(["✔️", "▶️", "♥️", "☺️", "↔️"])
    expect(find("済✔️✅ 完了")).toEqual(["✔️✅"])
    expect(find("©️ ®️ ™️")).toEqual([])
  })

  test("takes a flag as one run", () => {
    expect(find("日本🇯🇵です。")).toEqual(["🇯🇵"])
  })

  test("is quiet on ©, ®, ™, digits, and a keycap sequence", () => {
    expect(find("© 2026 ACME® Tool™ 1 # *")).toEqual([])
    expect(find("1️⃣ 2️⃣ #️⃣ *️⃣")).toEqual([])
    expect(find("矢印→と記号★です。")).toEqual([])
  })

  test("reads headings, list items and table rows, and neither code nor a quotation", () => {
    expect(find("## 完了🎉\n- 準備👍\n| 状態 |\n| --- |\n| ✅ |")).toEqual(["🎉", "👍", "✅"])
    expect(find("`🎉`と書く。\n\n```\n🔥\n```\n\n> ✨")).toEqual([])
  })
})
