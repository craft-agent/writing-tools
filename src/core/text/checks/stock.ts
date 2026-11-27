import { NOUN_CHAR, type Rewrite } from "./phrases"

/** The start of a sentence in a line: the start of the line, or after a terminator and any spaces. */
const SENTENCE_START = "(?<=^\\s*|[。！？!?]\\s*)"

/**
 * The phrases `stock_phrase` reports, as the package's own list: each adds
 * length and no meaning, and the shorter wording says the same. A phrase whose
 * shorter wording changes the meaning, or that a register or a field uses as
 * its plain word, is not on it. Every entry names a sample its pattern
 * matches, and the shorter wording is shorter than the match of that sample.
 */
export const STOCK_PHRASES: readonly Rewrite[] = [
  { pattern: "まず最初に", sample: "まず最初に確認します", shorter: "まず" },
  { pattern: "一番最初", sample: "一番最初の手順", shorter: "最初" },
  { pattern: "一番最後", sample: "一番最後の手順", shorter: "最後" },
  { pattern: "必ず必要", sample: "必ず必要になります", shorter: "必要" },
  {
    // A later regret only: after an action, in `した後で後悔`, the time is part of the meaning.
    pattern: "(?<![\\p{Script=Han}たっだの])(?:あと|後)で後悔",
    sample: "あとで後悔する",
    shorter: "後悔",
  },
  { pattern: "違和感を感じる", sample: "違和感を感じる", shorter: "違和感がある" },
  { pattern: "今現在", sample: "今現在の状況", shorter: "現在" },
  {
    // Between 各 and ごと only a name: a particle means 各 and ごと do not share a noun.
    pattern: "各[^、。，．！？!?\\s「」（）()がのはをにでともやへ]{1,10}?ごと(?![くし])",
    sample: "各チームごと",
    shorter: "",
    note: "say 各 or ごと, not both",
  },
  {
    pattern: "返事を返(しました|します|した|して|す)",
    sample: "返事を返します",
    shorter: ([, ending]) => `返事${ending === "す" ? "する" : ending}`,
  },
  { pattern: "頭痛が痛", sample: "頭痛が痛い", shorter: "頭が痛" },
  {
    pattern: `${SENTENCE_START}いかがでした(?:でしょう)?か[？?]?`,
    sample: "いかがでしたか？",
    shorter: "",
  },
  { pattern: `${SENTENCE_START}結論から言うと、`, sample: "結論から言うと、必要です", shorter: "" },
  {
    pattern: `(?<=${NOUN_CHAR})という形になります`,
    sample: "返金という形になります",
    shorter: "になります",
  },
  { pattern: `(?<=${NOUN_CHAR})という形です`, sample: "例外という形です", shorter: "です" },
]
