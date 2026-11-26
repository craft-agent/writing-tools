import { readDocument } from "./document"
import { MASK_CHAR, type MaskKind } from "./model"

const SHOWN_MASK = "□"

/** The masked text of a text, a masked unit shown as `□`. */
export function shown(text: string): string {
  return readDocument(text).masked.replaceAll(MASK_CHAR, SHOWN_MASK)
}

/** The kind of every line of a text. */
export function kinds(text: string): string[] {
  return readDocument(text).lines.map((line) => line.kind)
}

/** The text of every mask of a text, with its kind. */
export function masksOf(text: string): [MaskKind, string][] {
  return readDocument(text).masks.map((mask) => [mask.kind, text.slice(mask.start, mask.end)])
}

/** The text of every sentence of a text, with its terminator. */
export function sentencesOf(text: string): [string, string | null][] {
  return readDocument(text).sentences.map((sentence) => [text.slice(sentence.start, sentence.end), sentence.terminator])
}
