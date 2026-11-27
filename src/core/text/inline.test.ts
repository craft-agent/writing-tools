import { describe, expect, test } from "bun:test"
import { masksOf, shown } from "./document.testing"

describe("inline code", () => {
  test("masks the whole span, backticks included", () => {
    expect(masksOf("a `code` b")).toEqual([["code", "`code`"]])
    expect(shown("a `code` b")).toBe("a □□□□□□ b")
  })

  test("closes a span only with a run of the same length", () => {
    expect(masksOf("``X ` Y`` z")).toEqual([["code", "``X ` Y``"]])
    expect(masksOf("`a`` b`")).toEqual([["code", "`a`` b`"]])
  })

  test("leaves an unmatched backtick run and its neighbours read", () => {
    expect(masksOf("a ` b ``` c")).toEqual([])
    expect(masksOf("a ` b `code`")).toEqual([["code", "` b `"]])
  })

  test("takes a comment or a link inside a span as code", () => {
    expect(masksOf("`<!--` 本文 `](x)`")).toEqual([
      ["code", "`<!--`"],
      ["code", "`](x)`"],
    ])
  })
})

describe("links", () => {
  test("keeps the link text read and masks the target", () => {
    expect(shown("[Gitの使い方](https://example.com) を読む。")).toBe("[Gitの使い方□□□□□□□□□□□□□□□□□□□□□□ を読む。")
    expect(masksOf("[a](https://example.com)")).toEqual([["link_target", "](https://example.com)"]])
  })

  test("balances the parentheses of a target and honours escapes", () => {
    expect(masksOf("[使い方](https://example.com/a(b)c) を読む。")).toEqual([
      ["link_target", "](https://example.com/a(b)c)"],
    ])
    expect(masksOf("[a](b\\)c) d")).toEqual([["link_target", "](b\\)c)"]])
    expect(masksOf('[a](https://x.test/y "title") d')).toEqual([["link_target", '](https://x.test/y "title")']])
  })

  test("masks a target that never closes up to the end of the line", () => {
    expect(masksOf("[a](b\n次")).toEqual([["link_target", "](b"]])
  })

  test("masks reference labels, full and collapsed", () => {
    expect(masksOf("[API][ref] と [API][] と [x]")).toEqual([
      ["link_target", "][ref]"],
      ["link_target", "][]"],
    ])
  })

  test("reads an image's alt text like link text", () => {
    expect(shown("![画像の説明](a.png) 本文")).toBe("![画像の説明□□□□□□□□ 本文")
    expect(masksOf("![alt](a(1).png)")).toEqual([["link_target", "](a(1).png)"]])
  })

  test("masks a bare URL that is a link's own text without leaving its brackets half-masked", () => {
    expect(masksOf("[https://example.com/a](https://example.com/a)")).toEqual([
      ["url", "https://example.com/a"],
      ["link_target", "](https://example.com/a)"],
    ])
  })
})

describe("URLs and HTML", () => {
  test("masks a bare URL with a query up to a non-ASCII character", () => {
    expect(masksOf("詳細は https://example.com/a?b=1&c=2 を参照")).toEqual([["url", "https://example.com/a?b=1&c=2"]])
    expect(masksOf("http://example.com/日本語")).toEqual([["url", "http://example.com/"]])
  })

  test("leaves trailing punctuation out of a bare URL", () => {
    expect(masksOf("(https://example.com/a).")).toEqual([["url", "https://example.com/a"]])
    expect(masksOf("見る: https://example.com/a?b=1!?, ok")).toEqual([["url", "https://example.com/a?b=1"]])
    expect(masksOf('"https://example.com/a".')).toEqual([["url", "https://example.com/a"]])
    expect(masksOf("https:// だけ")).toEqual([])
  })

  test("masks autolinks and inline HTML tags as html", () => {
    expect(masksOf("詳細は <https://example.com/a?b=1&c=2> を参照")).toEqual([
      ["html", "<https://example.com/a?b=1&c=2>"],
    ])
    expect(masksOf('a<br>b <span class="x">c</span>')).toEqual([
      ["html", "<br>"],
      ["html", '<span class="x">'],
      ["html", "</span>"],
    ])
    expect(masksOf("1 < 2 と 3 > 2 と <")).toEqual([])
  })

  test("masks a comment on one line or across lines", () => {
    expect(masksOf("a <!-- hidden --> b")).toEqual([["comment", "<!-- hidden -->"]])
    const text = "前 <!-- 一\n二\n\n三 --> 後\n本文"
    expect(masksOf(text)).toEqual([["comment", "<!-- 一\n二\n\n三 -->"]])
    expect(shown(text)).toBe("前 □□□□□□\n□\n\n□□□□□ 後\n本文")
  })

  test("runs an unclosed comment to the end of the text", () => {
    expect(masksOf("a <!-- open\nb")).toEqual([["comment", "<!-- open\nb"]])
  })

  test("does not open a comment inside code", () => {
    expect(masksOf("`<!--` 本文\n次")).toEqual([["code", "`<!--`"]])
  })
})

describe("escapes", () => {
  test("masks only the backslash of an escape", () => {
    expect(masksOf("\\*\\*not bold\\*\\* __yes__")).toEqual([
      ["escape", "\\"],
      ["escape", "\\"],
      ["escape", "\\"],
      ["escape", "\\"],
    ])
    expect(shown("\\*a")).toBe("□*a")
  })

  test("lets an escape keep its character from starting a span", () => {
    expect(masksOf("\\`not code` \\[x\\]\\(y)")).toEqual([
      ["escape", "\\"],
      ["escape", "\\"],
      ["escape", "\\"],
      ["escape", "\\"],
    ])
  })

  test("leaves a backslash before a letter, or at the end, read", () => {
    expect(masksOf("C:\\Users\\")).toEqual([])
  })
})
