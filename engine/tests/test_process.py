"""One UTF-8 request and one compact reply through a real subprocess."""

import json
import os
import subprocess
import sys
import unittest

from support import ENGINE, FAKE, BridgeTest, make_request, reply_of, run_bridge


class TestProcess(BridgeTest):
    """Check bytes, exit status and import failures independently of the host."""

    def test_success_is_one_compact_non_ascii_line(self):
        process = run_bridge(make_request(segments=["東京😀"]))
        reply = reply_of(process)
        self.assertTrue(reply["ok"])
        self.assertEqual(process.stdout,
                         (json.dumps(reply, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8"))
        self.assertIn("東京".encode("utf-8"), process.stdout)
        self.assertIn("😀".encode("utf-8"), process.stdout)
        self.assertNotIn(b"\\u", process.stdout)

    def test_invalid_json_utf8_and_shapes(self):
        for data in (b"\xff", b'{"mode":"C","segments":["\xff"]}', "", "{private manuscript",
                     "null", "[]", '{"mode":"C","segments":[1]}',
                     '{"mode":"private manuscript","segments":[]}'):
            with self.subTest(data=data):
                reply = reply_of(run_bridge(data))
                self.assert_failure(reply, "invalid_request")
                self.assertNotIn("private manuscript", reply["error"])

    def test_missing_engine_without_fake_or_site_packages(self):
        reply = reply_of(run_bridge(make_request(segments=["private manuscript"]), fake=False))
        self.assert_failure(reply, "engine_missing")
        self.assertNotIn("private manuscript", reply["error"])

    def test_dictionary_failure_still_exits_zero(self):
        reply = reply_of(run_bridge(make_request(), patch="import sudachipy; sudachipy.CREATE_ERROR = True"))
        self.assert_failure(reply, "dictionary_failed")

    def test_unexpected_crash_exits_nonzero_without_exception_text(self):
        patch = (
            "def crash(request):\n"
            "    raise RuntimeError(request['segments'][0])\n"
            "bridge.handle = crash"
        )
        process = run_bridge(make_request(segments=["private manuscript"]), patch=patch)
        self.assertEqual(process.returncode, 1)
        self.assertEqual(process.stdout, b"")
        self.assertEqual(process.stderr, b"the bridge crashed: RuntimeError\n")

    def test_script_entrypoint_and_utf8_despite_ascii_locale(self):
        process = subprocess.run(
            [sys.executable, "-B", str(ENGINE / "bridge.py")],
            input=json.dumps(make_request(segments=["東京😀"]), ensure_ascii=False).encode("utf-8"),
            capture_output=True,
            env={**os.environ, "PYTHONPATH": str(FAKE), "PYTHONIOENCODING": "ascii",
                 "PYTHONUTF8": "0", "LC_ALL": "C"},
            timeout=30,
        )
        self.assertTrue(reply_of(process)["ok"])
        self.assertIn("東京".encode("utf-8"), process.stdout)


if __name__ == "__main__":
    unittest.main()
