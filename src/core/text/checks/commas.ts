import type { Sentence, TextDocument } from "../model"
import type { RawFinding } from "../rules"
import { CLOSING_BRACKETS, OPENING_BRACKETS } from "../sentences"
import { COMMAS } from "./chars"
import { compactLength } from "./length"
import { COMMA_CLAUSE_MAX_LENGTH, COMMA_RUN_MIN_CLAUSES, COMMA_RUN_MIN_LINKED } from "./thresholds"

/**
 * What a clause ends in when it hangs on the next one: a particle (に は も で
 * と が へ), a conjunctive form (て ば く り ず ら) or a linking word. The
 * package's own list. い is left out, since it ends the nouns and adjectives
 * of a plain list, and を, の and や because they end the items of one.
 */
const CLAUSE_LINKS = [..."にはもでとがへてばくりずら", "から", "ので", "ため", "ほど", "くらい"]

const WHITESPACE = /\s/

/** A clause that ends at a comma: where it starts and ends in the document's text (the comma excluded), and whether it is short and hangs on the next. */
type Clause = { start: number; end: number; short: boolean; linked: boolean }

/** The clauses of a sentence that end at a comma outside brackets; what follows the last comma ends at the terminator and is not one. */
function clausesOf(doc: TextDocument, { start, end }: Sentence): Clause[] {
  const clauses: Clause[] = []
  let clauseStart = -1
  let depth = 0
  for (let at = start; at < end; at++) {
    const char = doc.masked[at]
    if (WHITESPACE.test(char)) continue
    if (clauseStart < 0) clauseStart = at
    if (OPENING_BRACKETS.has(char)) depth++
    else if (CLOSING_BRACKETS.has(char)) depth = Math.max(0, depth - 1)
    else if (depth === 0 && COMMAS.includes(char)) {
      const clause = doc.masked.slice(clauseStart, at).trimEnd()
      const length = compactLength(clause)
      clauses.push({
        start: clauseStart,
        end: at,
        short: length > 0 && length <= COMMA_CLAUSE_MAX_LENGTH,
        linked: CLAUSE_LINKS.some((link) => clause.endsWith(link)),
      })
      clauseStart = -1
    }
  }
  return clauses
}

/** The maximal runs of consecutive short clauses. */
function shortRuns(clauses: readonly Clause[]): Clause[][] {
  const runs: Clause[][] = []
  let current: Clause[] | undefined
  for (const clause of clauses) {
    if (!clause.short) {
      current = undefined
    } else if (current === undefined) {
      current = [clause]
      runs.push(current)
    } else {
      current.push(clause)
    }
  }
  return runs
}

/**
 * The `comma_run` findings: in a sentence, three or more short clauses in a
 * row that each end at a comma, at least two of them in a particle or a
 * conjunctive form, so a list of nouns is not one. One per run, from the
 * start of its first clause through its last comma.
 */
export function findCommaRun(doc: TextDocument, sentences: readonly Sentence[]): RawFinding[] {
  return sentences.flatMap((sentence) =>
    shortRuns(clausesOf(doc, sentence))
      .filter(
        (run) =>
          run.length >= COMMA_RUN_MIN_CLAUSES && run.filter(({ linked }) => linked).length >= COMMA_RUN_MIN_LINKED,
      )
      .map((run) => ({
        rule: "comma_run",
        start: run[0].start,
        end: run[run.length - 1].end + 1,
        reason: `${run.length} clauses of ${COMMA_CLAUSE_MAX_LENGTH} characters or fewer in a row, each ending at a comma; a longer clause or two sentences may read smoother`,
      })),
  )
}
