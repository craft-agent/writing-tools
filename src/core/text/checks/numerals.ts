/**
 * The value of a numeral as digits, the package's own reading of how Japanese
 * writes numbers: digits in either width with comma grouping and a decimal
 * point, and kanji numerals, which are either positional (`二〇二六`) or built
 * from 十 百 千 and the larger 万 億 兆 (`三千五百万`), and may mix with digits
 * (`3万5,000`).
 */

/** The kanji digits, in the order of their values, 〇 first. */
export const KANJI_DIGITS = "〇一二三四五六七八九"

/** The kanji that multiply the digit before them within a group of four digits. */
export const SMALL_UNITS = "十百千"

/** The kanji that multiply a whole group of up to four digits. */
export const BIG_UNITS = "万億兆"

const SMALL_VALUES = new Map([...SMALL_UNITS].map((unit, at) => [unit, 10n ** BigInt(at + 1)]))
const BIG_VALUES = new Map([...BIG_UNITS].map((unit, at) => [unit, 10n ** BigInt(4 * (at + 1))]))

/** One number of a numeral after its commas are taken out: a run of digits with an optional decimal part, or a single kanji. */
const TOKEN = new RegExp(`[0-9]+(?:\\.[0-9]+)?|[${KANJI_DIGITS}${SMALL_UNITS}${BIG_UNITS}]`, "gu")

/** An exact decimal: `digits` over ten to the `scale`. */
type Decimal = { digits: bigint; scale: number }

const ZERO: Decimal = { digits: 0n, scale: 0 }
const ONE: Decimal = { digits: 1n, scale: 0 }

function decimalOf(text: string): Decimal {
  const [whole, fraction = ""] = text.split(".")
  return { digits: BigInt(whole + fraction), scale: fraction.length }
}

function plus(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale)
  return { digits: a.digits * 10n ** BigInt(scale - a.scale) + b.digits * 10n ** BigInt(scale - b.scale), scale }
}

function times(value: Decimal, factor: bigint): Decimal {
  return { digits: value.digits * factor, scale: value.scale }
}

/** The decimal in its plainest form: no leading zeros, no trailing zeros after the point, no point without a fraction. */
function show({ digits, scale }: Decimal): string {
  const text = digits.toString().padStart(scale + 1, "0")
  const whole = text.slice(0, text.length - scale)
  const fraction = text.slice(text.length - scale).replace(/0+$/, "")
  return fraction === "" ? whole : `${whole}.${fraction}`
}

/**
 * The value of a numeral, written the plainest way: `1,000` and `１０００` are
 * `1000`, `三千五百万` is `35000000`, `二〇二六` is `2026` (digit by digit),
 * `3万` is `30000` and `3.50` is `3.5`. A numeral that holds nothing but
 * digits is read digit by digit; 十 百 千 multiply the digits before them (one
 * when there are none) within a group, and 万 億 兆 the group.
 */
export function valueOf(numeral: string): string {
  let total = ZERO
  let group = ZERO
  let pending: string | undefined
  const settle = (): Decimal => {
    const value = pending === undefined ? ZERO : decimalOf(pending)
    pending = undefined
    return value
  }
  for (const token of numeral.normalize("NFKC").replaceAll(",", "").match(TOKEN) ?? []) {
    const small = SMALL_VALUES.get(token)
    const big = BIG_VALUES.get(token)
    if (small !== undefined) {
      group = plus(group, times(pending === undefined ? ONE : settle(), small))
    } else if (big !== undefined) {
      group = plus(group, settle())
      total = plus(total, times(group.digits === 0n ? ONE : group, big))
      group = ZERO
    } else {
      pending = (pending ?? "") + (KANJI_DIGITS.includes(token) ? String(KANJI_DIGITS.indexOf(token)) : token)
    }
  }
  return show(plus(plus(total, group), settle()))
}
