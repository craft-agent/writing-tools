import { AFTER_SURU_NOUN, NOUN_CHAR, type Rewrite } from "./phrases"

/** What may follow `できる` in `することができる`: its own endings. */
const CAN_END = "(?=[るまなたて])"

/** The nouns that `を行う` turns into a verb. */
const ACTION_NOUNS = "確認|変更|設定|保存|削除|作成|更新|実行|検討|説明|調査|対応|追加|修正"

/** The endings of `行う` after `を`, longest first, and what stands for each after the noun: `確認を行います` is `確認します`. */
const DO_ENDINGS: Readonly<Record<string, string>> = {
  いました: "しました",
  います: "します",
  った: "した",
  って: "して",
  う: "する",
  い: "し",
}

/** The endings after `することが可能` (`だった` is left out), and what says the same after the noun: `変更することが可能です` is `変更できます`. */
const POSSIBLE_ENDINGS: Readonly<Record<string, string>> = {
  です: "できます",
  だ: "できる",
  になる: "できるようになる",
  となる: "できるようになる",
}

/**
 * The constructions `translationese` reports, as the package's own list: each
 * is carried over from a translation, and a native form says the same in
 * fewer characters. A construction that wants `する` takes a noun of two
 * characters before it, so a verb of its own (`愛する`) or `を` before `する`
 * does not match. Every entry names a sample its pattern matches, and the
 * shorter wording is shorter than the match of that sample.
 */
export const TRANSLATIONESE: readonly Rewrite[] = [
  {
    pattern: `${AFTER_SURU_NOUN}することができ${CAN_END}`,
    sample: "確認することができます",
    shorter: "でき",
  },
  {
    // The other verbs: the potential form depends on the verb, so no wording is named.
    pattern: `(?<=[うくぐすつぬぶむる])(?<!${NOUN_CHAR}{2}する)ことができ${CAN_END}`,
    sample: "読むことができる",
    shorter: "",
    note: "the potential form of the verb says the same",
  },
  {
    pattern: `${AFTER_SURU_NOUN}することが可能(${Object.keys(POSSIBLE_ENDINGS).join("|")})(?!っ)`,
    sample: "変更することが可能です",
    shorter: ([, ending]) => POSSIBLE_ENDINGS[ending],
  },
  { pattern: "することによって", sample: "再起動することによって", shorter: "することで" },
  {
    pattern: `(${ACTION_NOUNS})を行(${Object.keys(DO_ENDINGS).join("|")})`,
    sample: "確認を行います",
    shorter: ([, noun, ending]) => `${noun}${DO_ENDINGS[ending]}`,
  },
  { pattern: `(?<=${NOUN_CHAR})という点において`, sample: "速度という点において", shorter: "の点で" },
  {
    pattern: `${AFTER_SURU_NOUN}することを可能にする`,
    sample: "共有することを可能にする",
    shorter: "できるようにする",
  },
]
