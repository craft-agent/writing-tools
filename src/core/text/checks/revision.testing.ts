import { invoke, type ToolOptions } from "../../tool"
import { writingTextRead } from "../read"
import type { TextReadInput, TextReadOutput } from "../schemas"

/** The arguments of a `compare` call besides the two texts. */
type Given = Partial<Omit<TextReadInput, "method" | "text" | "original">>

/** The report of `compare` for a revision and the original it was made from, as `invoke` returns it. */
export function revise(
  original: string,
  revision: string,
  given: Given = {},
  options: ToolOptions = {},
): Promise<TextReadOutput> {
  return invoke(
    writingTextRead,
    { method: "compare", text: revision, original, ...given },
    { cwd: process.cwd(), options },
  )
}

/** The rule and the reason of each finding of a `compare` report, in position order. */
export function reasons(report: TextReadOutput): [string, string][] {
  return report.findings.map(({ rule, reason }) => [rule, reason])
}
