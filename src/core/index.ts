export { ToolError, isAbortError, isToolError, type ErrorCode, type ErrorDetails, type JsonValue } from "./errors"
export { abortError, exec, type ExecOptions, type ExecResult } from "./exec"
export { exitFailure, run, type RunOptions } from "./runner"
export { MAX_SEGMENT_BYTES, analyze, type AnalyzeOptions } from "./engine/analyze"
export { installEngine, type InstallOptions } from "./engine/install"
export type { Morphology, NotRunReason, PartOfSpeech, SegmentAnalysis, SplitMode, Token } from "./engine/tokens"
export {
  DICTIONARY_VERSION,
  PYTHON_VERSION,
  SUDACHIPY_VERSION,
  enginePaths,
  readEngineState,
  type EnginePaths,
  type EngineState,
} from "./engine/state"
export {
  MAX_GRANT_DAYS,
  GRANTS_TOOLSET,
  RATE_WINDOW_MS,
  askPersonOnly,
  grantBounds,
  grantCheck,
  grantRefusal,
  grantTargets,
  grantTools,
  isPersonOnly,
  matchGrant,
  measureOf,
  type Grant,
  type GrantBoundValue,
  type GrantCall,
  type GrantContext,
  type GrantMatch,
  type GrantRefusal,
} from "./grant"
export { isWithin } from "./paths"
export type { ToolRuntime } from "./runtime"
export { ANY_TARGET, writeTargets } from "./targets"
export {
  REQUIRES_USER_INTERACTION,
  StepErrors,
  annotations,
  confirmWrite,
  defineTool,
  inputJsonSchema,
  invoke,
  outputJsonSchema,
  selectTools,
  toolMeta,
  type BoundSpec,
  type CallDescription,
  type CallFact,
  type CallHeadline,
  type CallMeasure,
  type CallText,
  type CallValue,
  type ConfirmRequest,
  type MeasuredValue,
  type OptionSpec,
  type OptionType,
  type ToolAnnotations,
  type ToolBounds,
  type ToolContext,
  type ToolOptionValue,
  type ToolOptions,
  type ToolSettings,
  type ToolSpec,
  type Toolsets,
  type WriteClass,
} from "./tool"
export {
  HEADLINE_PLACEHOLDER,
  MAX_FACTS,
  MAX_LABEL_LENGTH,
  MAX_TEXT_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_VALUE_LENGTH,
  MAX_VALUE_TEMPLATE_LENGTH,
  callDescription,
  cut,
  cutDescription,
  omittedBy,
  wholeCallDescription,
} from "./describe"
export { PIN_PATTERN, pinOf } from "./pin"
export { sizeFact } from "./facts"
export { CONVENTIONS, CONVENTION_NAMES, type ConventionName } from "./text/conventions"
export { locate, readDocument } from "./text/document"
export type { Block, Line, LineKind, Mask, MaskKind, Sentence, Terminator, TextDocument } from "./text/model"
export {
  ENGLISH,
  languageOf,
  mergeTranslations,
  translator,
  type Translations,
  type Translator,
  type Words,
} from "./words"
