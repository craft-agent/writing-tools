import type { EntryProfile } from "../entry/profile"

/** The exit codes of a command: it did its work, the work failed, or the command line was wrong. */
export const EXIT_OK = 0
export const EXIT_FAILED = 1
export const EXIT_USAGE = 2

/** What a command needs from its surroundings; `main.ts` wires the process, a test supplies its own. */
export type CommandIo = {
  env: Record<string, string | undefined>
  profile?: EntryProfile
  stdout(text: string): void
  stderr(text: string): void
  ownDir?: string
  signal?: AbortSignal
}
