import { describe, expect, test } from "bun:test"
import { matched, reasonsOf } from "./readability.testing"

/** A sentence of `length` characters, the terminator included, that holds no comma and no kanji. */
function sentence(length: number): string {
  return `${"あ".repeat(length - 1)}。`
}

const find = (text: string, given = {}, options = {}) => matched("long_sentence", text, given, options)
const why = (text: string, given = {}, options = {}) => reasonsOf("long_sentence", text, given, options)

describe("long_sentence", () => {
  test("reports a sentence past 90 characters, spanning it, and leaves one of 90 alone", () => {
    expect(find(sentence(90))).toEqual([])
    expect(find(sentence(91))).toEqual([sentence(91)])
    expect(why(sentence(92))).toEqual([
      "92 characters, past 90; a sentence that holds two points may read better as two",
    ])
  })

  test("reports each long sentence of a paragraph", () => {
    expect(find(`${sentence(95)}${sentence(10)}${sentence(100)}`)).toEqual([sentence(95), sentence(100)])
  })

  test("counts the terminator and the brackets that close the sentence, but not whitespace", () => {
    expect(find(`${"あ".repeat(89)}。」`)).toEqual([`${"あ".repeat(89)}。」`])
    expect(find(`${"あ ".repeat(80)}${"あ".repeat(9)}。`)).toEqual([])
    expect(find(`${"あ ".repeat(80)}${"あ".repeat(9)}。\n`)).toEqual([])
    expect(find(`${"あ ".repeat(80)}${"あ".repeat(10)}。`)).toHaveLength(1)
  })

  test("counts a code point once, whatever its length in UTF-16", () => {
    expect(find(`${"𠀀".repeat(89)}。`)).toEqual([])
    expect(find(`${"𠀀".repeat(90)}。`)).toHaveLength(1)
  })

  test("reads a sentence across the soft line breaks of its paragraph", () => {
    const lines = `${"あ".repeat(50)}\n${"あ".repeat(41)}。`
    expect(find(lines)).toEqual([lines])
    expect(find(`${"あ".repeat(50)}\n${"あ".repeat(39)}。`)).toEqual([])
  })

  test("counts an inline code span or a URL as one character, however long", () => {
    expect(find(`${"あ".repeat(80)}\`${"x".repeat(200)}\`。`)).toEqual([])
    expect(find(`${"あ".repeat(80)}https://example.com/${"a".repeat(200)} です。`)).toEqual([])
    expect(find(`${"あ".repeat(88)}\`${"x".repeat(200)}\`。`)).toEqual([])
    expect(find(`${"あ".repeat(89)}\`${"x".repeat(200)}\`。`)).toHaveLength(1)
  })

  test("counts masked runs that whitespace or a character separates as one character each", () => {
    expect(find("あ`a` `b`です。", {}, { sentence_length: 6 })).toEqual([])
    expect(find("あ`a` `b`です。", {}, { sentence_length: 5 })).toEqual(["あ`a` `b`です。"])
    expect(find("あ`a`と`b`です。", {}, { sentence_length: 6 })).toHaveLength(1)
    expect(find("あ`a`https://example.com です。", {}, { sentence_length: 5 })).toEqual([])
    expect(find("あ`a`https://example.com です。", {}, { sentence_length: 4 })).toHaveLength(1)
  })

  test("reads a sentence that ends without a terminator, in a paragraph or a list item", () => {
    const open = "あ".repeat(95)
    expect(find(`${sentence(10)}${open}`)).toEqual([open])
    expect(find(`- ${open}`)).toEqual([open])
    expect(find(`- ${sentence(95)}\n- ${sentence(20)}`)).toEqual([sentence(95)])
  })

  test("does not read headings, table rows, quotations or code", () => {
    expect(find(`# ${sentence(120)}`)).toEqual([])
    expect(find(`| ${sentence(120)} | b |\n| --- | --- |`)).toEqual([])
    expect(find(`> ${sentence(120)}`)).toEqual([])
    expect(find(`\`\`\`\n${sentence(120)}\n\`\`\``)).toEqual([])
    expect(find(`<!-- ${sentence(120)} -->`)).toEqual([])
  })

  test("holds an essay to 110 characters and every other genre to 90", () => {
    expect(find(sentence(100), { genre: "essay" })).toEqual([])
    expect(find(sentence(111), { genre: "essay" })).toHaveLength(1)
    for (const genre of ["general", "technical", "business"] as const) {
      expect(find(sentence(91), { genre })).toHaveLength(1)
    }
  })

  test("is moved by the sentence_length setting, which holds every genre to its value", () => {
    expect(find(sentence(50))).toEqual([])
    expect(find(sentence(50), {}, { sentence_length: 40 })).toEqual([sentence(50)])
    expect(why(sentence(50), {}, { sentence_length: 40 })).toEqual([
      "50 characters, past 40; a sentence that holds two points may read better as two",
    ])
    expect(find(sentence(100), {}, { sentence_length: 120 })).toEqual([])
    expect(find(sentence(100), { genre: "essay" }, { sentence_length: 60 })).toHaveLength(1)
    expect(find(sentence(100), { genre: "technical" }, { sentence_length: 120 })).toEqual([])
  })

  test("is left out when exclude_rules names it", () => {
    expect(matched("long_sentence", sentence(120), { exclude_rules: ["long_sentence"] })).toEqual([])
  })
})
