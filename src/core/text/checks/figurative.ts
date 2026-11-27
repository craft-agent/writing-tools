import type { Phrase } from "./phrases"

/** What `vague_buzzword` says of a match. */
export const BUZZWORD_REASON = "a buzzword; say what it stands for"

/** What `metaphor_verb` says of a match. */
export const METAPHOR_REASON = "a metaphor; the plain verb may read clearer"

/** What the literal `解像度` belongs to, when one of these stands within six characters before it. */
const SCREEN_WORDS =
  "画面|画像|映像|動画|写真|ディスプレイ|モニター|カメラ|液晶|パネル|スキャナ|プリンタ|テレビ|ピクセル|4K|8K"

/**
 * The buzzwords `vague_buzzword` reports, as the package's own list. A word
 * that has a literal use (`解像度`, `熱量`, `刺さる`) matches only in the frame
 * where it is figurative. A sample is a text the pattern matches.
 */
export const VAGUE_BUZZWORDS: readonly Phrase[] = [
  {
    pattern: `(?<!(?:${SCREEN_WORDS}).{0,6})解像度(?:を(?:上げ|高め)|が(?:高|低|上が|粗|足り))`,
    sample: "課題の解像度を上げる",
  },
  { pattern: "腹落ち", sample: "腹落ちする" },
  { pattern: "肌感覚", sample: "肌感覚がある" },
  { pattern: "温度感", sample: "温度感をそろえる" },
  { pattern: "熱量(?:を(?:感じ|込め|伝え)|が(?:伝わ|足りな|こも))", sample: "熱量を感じる" },
  { pattern: "(?:心|ユーザー|顧客|読者|ターゲット|若者|層)に刺さ", sample: "読者に刺さる" },
  { pattern: "エモ(?:い|く|さ)", sample: "エモい文章" },
  { pattern: "地に足(?:の|が)(?:ついた|着いた|付いた)", sample: "地に足のついた計画" },
  { pattern: "本質的な", sample: "本質的な課題" },
  { pattern: "爆速", sample: "爆速で進める" },
  { pattern: "言語化", sample: "考えを言語化する" },
  { pattern: "落とし込(?:む|み|ん|め)", sample: "計画に落とし込む" },
  { pattern: "ブラッシュアップ", sample: "企画をブラッシュアップする" },
  { pattern: "ゲームチェンジャー", sample: "市場のゲームチェンジャー" },
  { pattern: "(?:お客様|顧客|ユーザー|現場|課題)に寄り添", sample: "現場に寄り添う" },
]

/**
 * The metaphors `metaphor_verb` reports, as the package's own list: a verb
 * that stands for a plain action. Each matches only with the kind of object
 * that makes it a metaphor (`業務を回す`, not `現場を回る`). A sample is a text
 * the pattern matches.
 */
export const METAPHOR_VERBS: readonly Phrase[] = [
  { pattern: "(?:業務|仕事|案件|組織)(?:を回(?:す|し)|が回(?:る|ら|っ))", sample: "業務を回す" },
  { pattern: "時間(?:を溶か|が溶け)", sample: "会議が時間を溶かす" },
  { pattern: "(?:合意|方針|認識)を握(?:る|り|っ)", sample: "合意を握る" },
  { pattern: "機能(?:が生え|を生や)", sample: "新しい機能が生える" },
  { pattern: "(?:操作|画面|アプリ|ツール|サービス|UI|API|使い)の?手触り", sample: "操作の手触りがよい" },
  { pattern: "じわじわ(?:と)?効(?:い|く|き)", sample: "施策がじわじわ効く" },
  { pattern: "地味に効(?:い|く|き)", sample: "この改善は地味に効く" },
  {
    pattern: "(?:決断|挑戦|導入|判断|行動|成長|ユーザー|顧客|読者|部下|チーム|メンバー)の背中を押(?:す|し|さ)",
    sample: "導入の背中を押す",
  },
  { pattern: "(?:組織|職場|社内|チーム|会社|部署)の?風通し", sample: "組織の風通しがよい" },
  { pattern: "(?:課題|業務|タスク|施策|機能)を棚卸し", sample: "課題を棚卸しする" },
  { pattern: "地雷を踏(?:む|み|ん)", sample: "仕様の地雷を踏む" },
  { pattern: "(?:課題|問題|原因)を(?:炙|あぶ)り出", sample: "課題を炙り出す" },
]
