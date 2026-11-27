import type { CheckContext, CheckResult } from "../rules"
import { KATAKANA } from "./chars"
import { judgeConvention, occurrenceOf, type Occurrence } from "./convention"
import type { LineView } from "./lines"

/** The long vowel mark that `long_vowel` keeps or drops. */
const LONG_VOWEL = "ー"

/**
 * The katakana words the package lists in both forms, written with the
 * closing ー; the form without it is the same word. They are the package's
 * own data, chosen among the words that both forms are in use for.
 */
export const LONG_VOWEL_WORDS: readonly string[] = [
  "コンピューター",
  "ユーザー",
  "サーバー",
  "プリンター",
  "フォルダー",
  "ブラウザー",
  "パラメーター",
  "エディター",
  "ドライバー",
  "スキャナー",
  "マネージャー",
  "コンテナー",
  "ヘッダー",
  "フッター",
  "フィルター",
  "アダプター",
  "モニター",
  "センサー",
  "コントローラー",
  "プロバイダー",
  "インストーラー",
  "ビューアー",
  "プレイヤー",
  "レンダラー",
  "パーサー",
  "ハンドラー",
  "ルーター",
  "クラスター",
  "バッファー",
  "カウンター",
  "イテレーター",
  "ジェネレーター",
  "コンストラクター",
  "ポインター",
  "リスナー",
  "ローダー",
  "リーダー",
  "ライター",
  "メンバー",
  "オーナー",
  "メモリー",
  "カテゴリー",
  "ディレクトリー",
  "ライブラリー",
  "エントリー",
  "セキュリティー",
  "プロパティー",
  "ユーティリティー",
  "リポジトリー",
  "クエリー",
  "バッテリー",
]

/** Each form of each listed word, and the value of `long_vowel` it writes. */
const VALUE_OF_FORM = new Map(
  LONG_VOWEL_WORDS.flatMap((word) => [
    [word, "keep"],
    [word.slice(0, -LONG_VOWEL.length), "drop"],
  ]),
)

const KATAKANA_RUN = new RegExp(`${KATAKANA}+`, "g")

/** The other form of a listed word, given one of its forms. */
function otherForm(form: string): string {
  return form.endsWith(LONG_VOWEL) ? form.slice(0, -LONG_VOWEL.length) : `${form}${LONG_VOWEL}`
}

/**
 * Every listed word written as a whole katakana run, by whether it keeps its
 * closing ー. A word inside a longer run (`サーバーサイド`, `メモリーカード`,
 * `ユーザビリティ`) is not the listed word.
 */
export function findLongVowel(lines: readonly LineView[]): Occurrence[] {
  return lines.flatMap(({ start, text }) =>
    [...text.matchAll(KATAKANA_RUN)].flatMap((match) => {
      const value = VALUE_OF_FORM.get(match[0])
      return value === undefined ? [] : [occurrenceOf(value, start, match)]
    }),
  )
}

/** Judges `long_vowel` as any convention, and names the other form of the word in each reason. */
export function judgeLongVowel(ctx: CheckContext, occurrences: readonly Occurrence[]): CheckResult {
  const result = judgeConvention(ctx, "long_vowel", occurrences)
  return {
    ...result,
    findings: result.findings.map((item) => ({
      ...item,
      reason: `${item.reason}; the other form is "${otherForm(ctx.doc.text.slice(item.start, item.end))}"`,
    })),
  }
}
