import { describe, expect, test } from "bun:test"
import { readDocument } from "../document"
import { termsOf } from "./terms"

/** The term and whether it is glossed, for each term found in the text, in order of first use. */
const glossed = (text: string) => termsOf(readDocument(text)).map(({ term, glossed: yes }) => [term, yes])

describe("a glossed term", () => {
  test.each([
    ["API（Application Programming Interface）を使う。", "API"],
    ["API (Application Programming Interface) を使う。", "API"],
    ["API　（アプリケーション）を使う。", "API"],
    ["APIとは何か。", "API"],
    ["APIと呼ぶ。", "API"],
    ["APIと呼ばれる仕組み。", "API"],
    ["APIという仕組み。", "API"],
    ["サーバー（server）を使う。", "サーバー"],
  ])("is one that a bracket or a defining phrase follows: %s", (text, term) => {
    expect(glossed(text)).toContainEqual([term, true])
  })

  test("is one that sits alone in brackets right after other text", () => {
    expect(glossed("Application Programming Interface（API）を使う。")).toEqual([["API", true]])
    expect(glossed("Application Programming Interface(API)")).toContainEqual(["API", true])
    expect(glossed("Application Programming Interface（API)")).toContainEqual(["API", true])
  })

  test("is one with any use glossed, whichever use comes first", () => {
    expect(glossed("APIを使う。APIとは何か。")).toEqual([["API", true]])
    expect(glossed("APIとは何か。APIを使う。")).toEqual([["API", true]])
  })

  test("is one with a use in another form glossed", () => {
    expect(glossed("サーバを使う。ｻｰﾊﾞｰとは何か。")).toEqual([["サーバ", true]])
  })
})

describe("a term that is not glossed", () => {
  test("is one with no bracket and no defining phrase after any use", () => {
    expect(glossed("APIを使う。HTTP2の仕組み。サーバーは速い。")).toEqual([
      ["API", false],
      ["HTTP2", false],
      ["サーバー", false],
    ])
  })

  test("is one whose defining phrase stands apart from it, or whose bracket does not follow it", () => {
    expect(glossed("API とは何か。")).toEqual([["API", false]])
    expect(glossed("APIの（注）を読む。")).toEqual([["API", false]])
  })

  test("is one in brackets at the start of a line or after a space, or not alone in them", () => {
    expect(glossed("（API）を使う。")).toEqual([["API", false]])
    expect(glossed("この （API）を使う。")).toEqual([["API", false]])
    expect(glossed("ここで（API、HTTP）を使う。")).toEqual([
      ["API", false],
      ["HTTP", false],
    ])
  })

  test("is one a bracket in the next line does not gloss", () => {
    expect(glossed("API\n（説明）")).toEqual([["API", false]])
  })
})
