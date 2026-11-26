"""Shared in-process and subprocess harnesses using the fake SudachiPy."""

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

TESTS = Path(__file__).resolve().parent
ENGINE = TESTS.parent
FAKE = TESTS / "fake"
HARNESS = """
import sys
sys.path[:0] = {paths!r}
import bridge
{patch}
sys.exit(bridge.main())
"""

sys.path[:0] = [str(FAKE), str(ENGINE)]

import bridge
import sudachipy


def make_request(**override) -> dict:
    """Return a good request with optional field replacements."""
    return {"mode": "C", "segments": ["東京都にABC12。"], **override}


def run_bridge(stdin: object, *, fake: bool = True, patch: str = "") -> subprocess.CompletedProcess:
    """Run one request (or raw bytes/text) in an isolated interpreter."""
    data = stdin if isinstance(stdin, (str, bytes)) else json.dumps(stdin, ensure_ascii=False)
    paths = [str(ENGINE), *([str(FAKE)] if fake else [])]
    env = {key: value for key, value in os.environ.items() if key != "PYTHONPATH"}
    if fake:
        env["PYTHONPATH"] = str(FAKE)
    return subprocess.run(
        [sys.executable, "-I", "-B", "-S", "-c", HARNESS.format(paths=paths, patch=patch)],
        input=data.encode("utf-8") if isinstance(data, str) else data,
        capture_output=True,
        env=env,
        timeout=30,
    )


def reply_of(process: subprocess.CompletedProcess) -> dict:
    """Require exit zero and exactly one line containing the reply."""
    assert process.returncode == 0, process.stderr.decode("utf-8")
    assert process.stderr == b"", process.stderr
    assert process.stdout.endswith(b"\n"), process.stdout
    lines = process.stdout.decode("utf-8").splitlines()
    assert len(lines) == 1, process.stdout
    return json.loads(lines[0])


class BridgeTest(unittest.TestCase):
    """Reset fake state and assert failure contracts."""

    def setUp(self):
        """Isolate dictionary hooks and recorded calls between tests."""
        sudachipy.DICTIONARY_ERROR = False
        sudachipy.CREATE_ERROR = False
        sudachipy.DICTIONARIES.clear()
        sudachipy.MODES.clear()
        sudachipy.TEXTS.clear()

    def assert_failure(self, reply: dict, kind: str):
        """Require a short, one-line failure message."""
        self.assertEqual(set(reply), {"ok", "kind", "error"})
        self.assertIs(reply["ok"], False)
        self.assertEqual(reply["kind"], kind)
        self.assertIsInstance(reply["error"], str)
        self.assertTrue(reply["error"])
        self.assertLess(len(reply["error"]), 100)
        self.assertEqual(len(reply["error"].splitlines()), 1)
