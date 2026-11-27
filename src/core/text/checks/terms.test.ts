import { describe, expect, test } from "bun:test"
import { readDocument } from "../document"
import { MAX_EXCERPT } from "../limits"
import { termsOf } from "./terms"

const terms = (...lines: string[]) => termsOf(readDocument(lines.join("\n")))

/** The term and kind of each term found, in order of first use. */
const kinds = (...lines: string[]) => terms(...lines).map(({ term, kind }) => [term, kind])

describe("the terms of each kind", () => {
  test("finds acronyms, Latin names and katakana words by their characters", () => {
    expect(kinds("APIとHTTP2はGitHubやTypeScript、macOS、iPhoneで使う。サーバーとデータベース。")).toEqual([
      ["API", "acronym"],
      ["HTTP2", "acronym"],
      ["GitHub", "latin"],
      ["TypeScript", "latin"],
      ["macOS", "latin"],
      ["iPhone", "latin"],
      ["サーバー", "katakana"],
      ["データベース", "katakana"],
    ])
  })

  test("judges a Latin word whole: the OS of iOS and the API of OpenAPI are no acronyms", () => {
    const found = terms("iOSとOpenAPIとAPI")
    expect(found.map(({ term, kind, count }) => [term, kind, count])).toEqual([
      ["iOS", "latin", 1],
      ["OpenAPI", "latin", 1],
      ["API", "acronym", 1],
    ])
  })

  test("takes no single capital, digit-led word, identifier or plain lowercase word", () => {
    expect(kinds("Aと3DとH2OとFOO_BARとsnake_caseとversion2と2024とdocker")).toEqual([])
  })

  test("splits at a dot or a hyphen, so each part is judged on its own", () => {
    expect(kinds("UTF-8とNode.jsとwi-fi")).toEqual([
      ["UTF", "acronym"],
      ["Node", "latin"],
    ])
  })

  test("takes a katakana run whole: データ inside データベース is no term of its own", () => {
    const found = terms("データベースを使う。")
    expect(found.map(({ term, count }) => [term, count])).toEqual([["データベース", 1]])
  })

  test("ends a katakana run at ・ and at the first character that is not katakana", () => {
    expect(kinds("データ・サーバ、ソフトウェア工学、ヴァイオリン")).toEqual([
      ["データ", "katakana"],
      ["サーバ", "katakana"],
      ["ソフトウェア", "katakana"],
      ["ヴァイオリン", "katakana"],
    ])
  })

  test("takes katakana of at least 3 characters, and none that starts with ー", () => {
    expect(kinds("ビルとサーとあーアイ、ーーー、コピー")).toEqual([["コピー", "katakana"]])
  })

  test("reads fullwidth Latin and halfwidth katakana, which stand as written", () => {
    expect(kinds("ＡＰＩとＧｉｔＨｕｂとｻｰﾊﾞｰとﾃﾞｰﾀ")).toEqual([
      ["ＡＰＩ", "acronym"],
      ["ＧｉｔＨｕｂ", "latin"],
      ["ｻｰﾊﾞｰ", "katakana"],
      ["ﾃﾞｰﾀ", "katakana"],
    ])
  })

  test("clips a term longer than an excerpt", () => {
    const [{ term }] = terms(`A${"b".repeat(200)}`)
    expect([...term]).toHaveLength(MAX_EXCERPT)
    expect(term.endsWith("…")).toBe(true)
  })
})

describe("a Capitalized Latin word", () => {
  test("is a name when it stands alone among Japanese text", () => {
    expect(kinds("Pythonで書く。Docker を使う。「Linux」と Python 3 の違い。")).toEqual([
      ["Python", "latin"],
      ["Docker", "latin"],
      ["Linux", "latin"],
    ])
  })

  test("is no name beside another Latin word across spaces, so a phrase is not listed word by word", () => {
    expect(kinds("Application Programming Interface")).toEqual([])
    expect(kinds("Visual Studio Code を開く。Linux  Kernel も同じ。")).toEqual([])
    expect(kinds("これは This is a test です。")).toEqual([])
    expect(kinds("Hello world. See Python docs.")).toEqual([])
  })

  test("is a name beside a Latin word that a hyphen, a dot or a digit-only run sets apart", () => {
    expect(kinds("Python-Docker と Node.js")).toEqual([
      ["Python", "latin"],
      ["Docker", "latin"],
      ["Node", "latin"],
    ])
  })

  test("counts only the uses that stand alone", () => {
    const [python] = terms("Python を使う。Python is fun. Pythonで書く。")
    expect(python).toMatchObject({ term: "Python", count: 2, line: 1, column: 1 })
  })

  test("leaves a word with a capital after its first character a name wherever it stands", () => {
    expect(kinds("Install GitHub and the iPhone app on macOS, via OpenAPI and iOS.")).toEqual([
      ["GitHub", "latin"],
      ["iPhone", "latin"],
      ["macOS", "latin"],
      ["OpenAPI", "latin"],
      ["iOS", "latin"],
    ])
  })

  test("leaves an acronym beside Latin words an acronym", () => {
    expect(kinds("Application Programming Interface（API）and the HTTP Server")).toEqual([
      ["API", "acronym"],
      ["HTTP", "acronym"],
    ])
  })
})

describe("the forms of a term", () => {
  test("group a closing ー and the widths as one term, with the count of each form in order of first use", () => {
    const [server, api] = terms("サーバとサーバーとｻｰﾊﾞｰとサーバー。ＡＰＩとAPIとAPI")
    expect(server).toMatchObject({
      term: "サーバー",
      kind: "katakana",
      count: 4,
      forms: [
        { form: "サーバ", count: 1 },
        { form: "サーバー", count: 2 },
        { form: "ｻｰﾊﾞｰ", count: 1 },
      ],
    })
    expect(api).toMatchObject({
      term: "API",
      count: 3,
      forms: [
        { form: "ＡＰＩ", count: 1 },
        { form: "API", count: 2 },
      ],
    })
  })

  test("name the first form used when the forms tie", () => {
    expect(terms("サーバーとサーバ")[0]).toMatchObject({ term: "サーバー", count: 2 })
    expect(terms("ｻｰﾊﾞとサーバー")[0]).toMatchObject({ term: "ｻｰﾊﾞ", count: 2 })
  })

  test("are left out when a term is written one way", () => {
    const [found] = terms("APIとAPI")
    expect(found.count).toBe(2)
    expect("forms" in found).toBe(false)
  })

  test("keep Latin names that differ in case apart, which only a style could unite", () => {
    expect(kinds("GitHubとGithub")).toEqual([
      ["GitHub", "latin"],
      ["Github", "latin"],
    ])
  })
})

describe("where a term is first used", () => {
  test("is the line and column, in code points, of its first use", () => {
    const [api, hub] = terms("あ", "いう😀API、API", "GitHub")
    expect(api).toMatchObject({ term: "API", count: 2, line: 2, column: 4 })
    expect(hub).toMatchObject({ term: "GitHub", line: 3, column: 1 })
  })

  test("reads headings, list items and table rows as well as prose, and not quotations or masked text", () => {
    expect(
      kinds(
        "---",
        "title: Jekyll",
        "---",
        "# TypeScript入門",
        "- Kotlinの項目",
        "",
        "| a | b |",
        "| --- | --- |",
        "| Redis | データ |",
        "",
        "> GitHubの引用",
        "",
        "`Docker`と[Gradle](https://example.com/Maven)と https://example.com/Nginx と<span class=Foo>",
        "<!-- Vue -->",
        "```",
        "Python",
        "```",
        "    Indented",
      ),
    ).toEqual([
      ["TypeScript", "latin"],
      ["Kotlin", "latin"],
      ["Redis", "latin"],
      ["データ", "katakana"],
      ["Gradle", "latin"],
    ])
  })
})
