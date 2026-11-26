import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { DICTIONARY_VERSION, SUDACHIPY_VERSION } from "../core"
import { tempDir } from "../core/engine/engine.testing"

/** A package directory holding the engine's requirements file. */
export async function ownDirWithLock(): Promise<string> {
  const dir = await tempDir()
  await mkdir(join(dir, "engine"))
  await writeFile(
    join(dir, "engine", "requirements.lock"),
    `SudachiPy==${SUDACHIPY_VERSION}\nsudachidict_core==${DICTIONARY_VERSION}\n`,
  )
  return dir
}
