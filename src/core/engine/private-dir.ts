import { chmod, lstat, mkdir } from "node:fs/promises"
import type { Stats } from "node:fs"
import { ToolError } from "../errors"

const DIR_MODE = 0o700

async function statOrUndefined(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}

async function refuseNonDirectory(dir: string): Promise<void> {
  const stat = await statOrUndefined(dir)
  if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) {
    throw new ToolError("invalid_argument", `"${dir}" exists and is not a directory (a symlink is not followed).`)
  }
}

/** Creates a private directory, tightening existing permissions and refusing symlinks. */
export async function ensurePrivateDir(dir: string): Promise<void> {
  await refuseNonDirectory(dir)
  await mkdir(dir, { recursive: true, mode: DIR_MODE })
  // A symlink put in place after the first check must not receive the chmod.
  await refuseNonDirectory(dir)
  await chmod(dir, DIR_MODE)
}
