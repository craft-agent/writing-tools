import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DICTIONARY_VERSION, PYTHON_VERSION, SUDACHIPY_VERSION, enginePaths } from "./state"

type FakeUvSetting = "python-version" | "sudachipy-version" | "dictionary-version" | "fail-venv" | "fail-sync"

const FAKE_UV_SCRIPT = `#!/bin/sh
dir=$(dirname "$0")
printf '%s\\n' "$*" >> "$dir/uv.log"
printf 'UV_NO_CONFIG=%s UV_CACHE_DIR=%s STRAY=%s HTTPS_PROXY=%s SSL_CERT_FILE=%s\\n' "$UV_NO_CONFIG" "$UV_CACHE_DIR" "$STRAY" "$HTTPS_PROXY" "$SSL_CERT_FILE" >> "$dir/uv.env"
case "$1" in
  --version)
    echo "uv 0.0.0"
    ;;
  venv)
    if [ -f "$dir/fail-venv" ]; then cat "$dir/fail-venv" >&2; exit 2; fi
    venv="$2"
    rm -rf "$venv"
    mkdir -p "$venv/bin"
    printf '#!/bin/sh\\n' > "$venv/bin/python"
    chmod 755 "$venv/bin/python"
    version=$(cat "$dir/python-version" 2>/dev/null || echo ${PYTHON_VERSION})
    printf 'home = /somewhere\\nversion_info = %s\\n' "$version" > "$venv/pyvenv.cfg"
    ;;
  pip)
    if [ -f "$dir/fail-sync" ]; then cat "$dir/fail-sync" >&2; exit 3; fi
    venv=$(dirname "$(dirname "$4")")
    sudachipy=$(cat "$dir/sudachipy-version" 2>/dev/null || echo ${SUDACHIPY_VERSION})
    dictionary=$(cat "$dir/dictionary-version" 2>/dev/null || echo ${DICTIONARY_VERSION})
    site="$venv/lib/python3.12/site-packages"
    rm -rf "$site"/sudachipy-*.dist-info "$site"/sudachidict_core-*.dist-info
    mkdir -p "$site/sudachipy-$sudachipy.dist-info" "$site/sudachidict_core-$dictionary.dist-info"
    ;;
esac
`

export type FakeUv = {
  bin: string
  env: Record<string, string>
  set(setting: FakeUvSetting, value: string): Promise<void>
  calls(): Promise<string[]>
  environments(): Promise<string[]>
}

const directories: string[] = []

export async function removeTempDirs(): Promise<void> {
  await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
}

export async function tempDir(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "engine-")))
  directories.push(dir)
  return dir
}

async function readLines(path: string): Promise<string[]> {
  try {
    return (await readFile(path, "utf8")).split("\n").filter((line) => line !== "")
  } catch {
    return []
  }
}

/** A fake uv on a private PATH, controlled by files rather than environment variables. */
export async function fakeUv(): Promise<FakeUv> {
  const bin = join(await tempDir(), "bin")
  await mkdir(bin)
  await writeFile(join(bin, "uv"), FAKE_UV_SCRIPT)
  await chmod(join(bin, "uv"), 0o755)
  return {
    bin,
    env: {
      PATH: `${bin}:/usr/bin:/bin`,
      HOME: bin,
      STRAY: "leaks",
      UV_CACHE_DIR: "/cache/uv",
      HTTPS_PROXY: "https://proxy.example",
      SSL_CERT_FILE: "/cert.pem",
    },
    set: (setting, value) => writeFile(join(bin, setting), value),
    calls: () => readLines(join(bin, "uv.log")),
    environments: () => readLines(join(bin, "uv.env")),
  }
}

export const NO_UV_ENV = { PATH: "/usr/bin:/bin" }
export type VenvLayout = { python?: boolean; pythonVersion?: string; sudachipy?: string; dictionary?: string }
export const PINNED_LAYOUT: VenvLayout = {
  pythonVersion: PYTHON_VERSION,
  sudachipy: SUDACHIPY_VERSION,
  dictionary: DICTIONARY_VERSION,
}

/** Lays out a venv as uv leaves it; omitted fields are not created. */
export async function writeVenv(stateDir: string, layout: VenvLayout = {}): Promise<void> {
  const { venv, python } = enginePaths(stateDir)
  await mkdir(join(venv, "bin"), { recursive: true })
  if (layout.python !== false) {
    await writeFile(python, "#!/bin/sh\n")
    await chmod(python, 0o755)
  }
  if (layout.pythonVersion !== undefined) {
    await writeFile(join(venv, "pyvenv.cfg"), `home = /somewhere\nversion_info = ${layout.pythonVersion}\n`)
  }
  for (const [name, version] of [
    ["sudachipy", layout.sudachipy],
    ["sudachidict_core", layout.dictionary],
  ]) {
    if (version !== undefined) {
      await mkdir(join(venv, "lib", "python3.12", "site-packages", `${name}-${version}.dist-info`), {
        recursive: true,
      })
    }
  }
}

export async function lockFile(): Promise<string> {
  const path = join(await tempDir(), "requirements.lock")
  await writeFile(path, `SudachiPy==${SUDACHIPY_VERSION}\nsudachidict_core==${DICTIONARY_VERSION}\n`)
  return path
}
