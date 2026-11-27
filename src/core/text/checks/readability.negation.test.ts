import { describe, expect, test } from "bun:test"
import { readTokens } from "./readability.tokens.testing"

const WORDS = [
  "知ら/動詞/一般=知る",
  "行か/動詞/非自立可能=行く",
  "行き/動詞/非自立可能=行く",
  "でき/動詞/非自立可能=できる",
  "言え/動詞/一般=言える",
  "言わ/動詞/一般=言う",
  "笑わ/動詞/一般=笑う",
  "あり/動詞/非自立可能=ある",
  "得/動詞/非自立可能=得る",
  "い/動詞/非自立可能=いる",
  "いけ/動詞/非自立可能=いける",
  "確認/名詞/サ変可能",
  "提出/名詞/サ変可能",
  "賛成/名詞/サ変可能",
  "連絡/名詞/サ変可能",
  "わけ/名詞/普通名詞",
  "こと/名詞/普通名詞",
  "はず/名詞/普通名詞",
  "もの/名詞/普通名詞",
  "訳/名詞/普通名詞",
  "本/名詞/普通名詞",
  "食べ/動詞/一般=食べる",
  "買わ/動詞/一般=買う",
  "じゃ/助動詞=だ",
  "何/代名詞",
  "ませ/助動詞=ます",
  "ん/助動詞=ぬ",
  "ざる/助動詞=ぬ",
  "ね/助動詞=ぬ",
  "ず/助動詞",
  "なく/助動詞=ない",
  "なかっ/助動詞=ない",
  "なけれ/助動詞=ない",
  "たく/助動詞=たい",
  "られ/助動詞=られる",
  "た/助動詞",
  "ば/助詞/接続助詞",
  "て/助詞/接続助詞",
]

/** The words with the negation `ない` as an auxiliary, as in `行かない`. */
const AUXILIARY = [...WORDS, "ない/助動詞"]

/** The words with `ない` as an adjective, as in `ことはない`. */
const ADJECTIVE = [...WORDS, "ない/形容詞/非自立可能"]

/** The conjunctive `と` of `ないと`, which the words leave to the case particle of the shared ones, as in `ないとは`. */
const CONJUNCTIVE_TO = "と/助詞/接続助詞"

/** `なら` as the conditional of `ないなら`, and as the verb of `ならない`. */
const CONDITIONAL_NARA = "なら/助動詞=だ"
const VERB_NARU = "なら/動詞/非自立可能=なる"

const find = (text: string, lexicon: readonly string[] = AUXILIARY) =>
  readTokens("double_negative", text, lexicon).map((hit) => hit.text)

describe("double_negative", () => {
  test.each([
    ["an auxiliary", AUXILIARY],
    ["an adjective", ADJECTIVE],
  ])("reports two negations close together, from the first through the second, when ない is %s", (_name, lexicon) => {
    expect(readTokens("double_negative", "知らないことはない。", lexicon)).toEqual([
      {
        text: "ないことはない",
        start: 2,
        reason:
          "two negations with only a formal noun, particles or the copula between them, which the reader must cancel against each other; stating the point without them may read clearer",
      },
    ])
    expect(find("賛成しないわけではない。", lexicon)).toEqual(["ないわけではない"])
    expect(find("できなくはない。", lexicon)).toEqual(["なくはない"])
  })

  test.each([
    ["行かないはずがない。", "ないはずがない"],
    ["行かないものではない。", "ないものではない"],
    ["行かないものでもない。", "ないものでもない"],
    ["知らない訳ではない。", "ない訳ではない"],
    ["知らないこともない。", "ないこともない"],
    ["知らないわけじゃない。", "ないわけじゃない"],
    ["行かないでもない。", "ないでもない"],
    ["使えなくもない。", "なくもない"],
    ["知らないことがありません。", "ないことがありません"],
  ])("reports a formal noun, particles and the copula between the negations: %s", (text, span) => {
    expect(find(text, [...AUXILIARY, "使え/動詞/一般=使える"])).toEqual([span])
  })

  test("reports a nominalizing の between them, and not the case-marking one", () => {
    expect(find("行かないのではない。", [...AUXILIARY, "の/助詞/準体助詞"])).toEqual(["ないのではない"])
    expect(find("行かないのではない。")).toEqual([])
  })

  test("leaves two negations alone when a content word stands between them", () => {
    expect(find("何も言わず何も食べなかった。")).toEqual([])
    expect(find("行かないし買わない。", [...AUXILIARY, "し/助詞/接続助詞"])).toEqual([])
    expect(find("できないとは言えない。")).toEqual([])
    expect(find("知らないことを知らない。")).toEqual([])
    expect(find("知らないわけでは本ありません。")).toEqual([])
  })

  test("takes a gap of six tokens and not seven", () => {
    expect(find("知らないわけでもありません。")).toEqual(["ないわけでもありません"])
    expect(find("知らないわけではもありません。")).toEqual([])
  })

  test("counts the words and not the spaces between them", () => {
    expect(find("知らないわけでは あり ませ ん。")).toEqual(["ないわけでは あり ませ ん"])
  })

  test("is broken by a mark between the negations", () => {
    expect(find("知らない、ことはない。")).toEqual([])
    expect(find("知らないことは「ない」。")).toEqual([])
  })

  test("reports every pair of a sentence, each negation in one pair at most", () => {
    expect(find("知らないことはないが、言えないことはない。")).toEqual(["ないことはない", "ないことはない"])
    expect(find("知らないことはない本できないことはない。")).toEqual(["ないことはない", "ないことはない"])
    expect(find("知らないことはないことはない。")).toEqual(["ないことはない"])
  })

  test("reports a pair in each sentence", () => {
    expect(find("知らないことはない。言えないことはない。")).toHaveLength(2)
  })

  test("counts one negation alone, ません included", () => {
    expect(find("行きません。")).toEqual([])
    expect(find("知らない。")).toEqual([])
    expect(find("行きたくはない。")).toEqual([])
  })

  test("counts a negation only as an auxiliary or an adjective", () => {
    expect(find("知らないことはない。", [...WORDS, "ない/名詞"])).toEqual([])
  })

  test("leaves obligations alone", () => {
    expect(find("提出しなければいけない。")).toEqual([])
    expect(find("提出しなくてはいけない。")).toEqual([])
    expect(find("提出しないといけない。", [...AUXILIARY, CONJUNCTIVE_TO])).toEqual([])
    expect(find("提出しなければならない。", [...AUXILIARY, VERB_NARU])).toEqual([])
    expect(find("行かねばならない。", [...AUXILIARY, VERB_NARU])).toEqual([])
    expect(find("行かざるを得ない。")).toEqual([])
  })

  test("leaves conditions alone: a negation before ば, て and は, a conjunctive と or なら", () => {
    expect(find("提出しなければ確認しない。")).toEqual([])
    expect(find("提出しなくては確認しない。")).toEqual([])
    expect(find("行かないと言えない。", [...AUXILIARY, CONJUNCTIVE_TO])).toEqual([])
    expect(find("行かないなら言わない。", [...AUXILIARY, CONDITIONAL_NARA])).toEqual([])
  })

  test("leaves the idioms alone: ずには, ないでは", () => {
    expect(find("笑わずにはいられない。")).toEqual([])
    expect(find("行かないではいられない。")).toEqual([])
  })

  test("still counts the negation that closes an obligation, against one after it", () => {
    expect(find("知らなければならないわけではない。", [...AUXILIARY, VERB_NARU])).toEqual(["ないわけではない"])
  })

  test("reads the sentences of list items too", () => {
    expect(find("- 知らないことはない。")).toEqual(["ないことはない"])
  })

  test("reports nothing without tokens, or for the blocks the engine skipped, and can be excluded", () => {
    expect(readTokens("double_negative", "知らないことはない。", undefined)).toEqual([])
    expect(readTokens("double_negative", "知らないことはない。", AUXILIARY, { only: [] })).toEqual([])
    expect(readTokens("double_negative", "知らないことはない。", AUXILIARY, { exclude: ["double_negative"] })).toEqual(
      [],
    )
  })
})
