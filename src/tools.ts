import type { ToolSpec } from "./core"
import { writingTextRead } from "./core/text/read"

/** Every tool spec of the package; entry points register their tools from this list. */
export const ALL_TOOLS: ToolSpec[] = [writingTextRead]
