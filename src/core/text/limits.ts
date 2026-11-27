/** The longest `text` the tool reads, in bytes of UTF-8; a longer one is refused, not checked in part. */
export const MAX_TEXT_BYTES = 131_072

/** The longest excerpt of a finding, in code points, its ellipses included. */
export const MAX_EXCERPT = 80

/** The most bytes of JSON a whole result takes; past it the lowest findings, then outline headings and terms, are cut. */
export const MAX_RESULT_BYTES = 65_536

/** How many findings a call returns when `limit` is left out. */
export const DEFAULT_LIMIT = 50

/** The most findings `limit` may ask for. */
export const MAX_LIMIT = 200

/** The most headings the `outline` inventory lists; the rest are counted in `cut`. */
export const MAX_OUTLINE_ENTRIES = 200

/** The most terms the `terms` inventory lists, the most used ones; the rest are counted in `cut`. */
export const MAX_TERMS = 100

/** The most line numbers one `not_run` entry lists, so a text of many skipped paragraphs does not fill the result. */
export const MAX_NOT_RUN_LINES = 50
