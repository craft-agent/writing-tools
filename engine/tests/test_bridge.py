"""The morphology protocol, using only the fake SudachiPy."""

import unittest
from unittest.mock import patch

from support import BridgeTest, bridge, make_request, sudachipy


class TestBridge(BridgeTest):
    """Check validation, token columns, POS interning and segment isolation."""

    def test_tokens_offsets_and_pos_table(self):
        reply = bridge.handle(make_request(segments=["😀𠮷野にABC12。", "東京カナ"]))
        self.assertIs(reply["ok"], True)
        self.assertEqual(reply["pos"], [
            list(sudachipy.POS[name])
            for name in ("other", "kanji", "hiragana", "latin", "katakana")
        ])
        self.assertEqual(reply["segments"], [
            {"tokens": [
                ["😀", 0, 1, 0, "😀", "dictionary:😀", "reading:😀"],
                ["𠮷野", 1, 3, 1, "𠮷野", "dictionary:𠮷野", "reading:𠮷野"],
                ["に", 3, 4, 2, "に", "dictionary:に", "reading:に"],
                ["ABC12", 4, 9, 3, "abc12", "dictionary:ABC12", "reading:ABC12"],
                ["。", 9, 10, 0, "。", "dictionary:。", "reading:。"],
            ]},
            {"tokens": [
                ["東京", 0, 2, 1, "東京", "dictionary:東京", "reading:東京"],
                ["カナ", 2, 4, 4, "カナ", "dictionary:カナ", "reading:カナ"],
            ]},
        ])
        self.assertEqual(sudachipy.DICTIONARIES, ["core"])
        self.assertEqual(sudachipy.MODES, [sudachipy.SplitMode.C])

    def test_empty_segments(self):
        self.assertEqual(bridge.handle(make_request(segments=[])),
                         {"ok": True, "pos": [], "segments": []})
        self.assertEqual(sudachipy.DICTIONARIES, ["core"])

    def test_empty_string(self):
        self.assertEqual(bridge.handle(make_request(segments=[""])),
                         {"ok": True, "pos": [], "segments": [{"tokens": []}]})
        self.assertEqual(sudachipy.TEXTS, [""])

    def test_all_modes_are_passed_to_create(self):
        for mode in ("A", "B", "C"):
            with self.subTest(mode=mode):
                self.assertTrue(bridge.handle(make_request(mode=mode))["ok"])
        self.assertEqual(sudachipy.MODES, list(sudachipy.SplitMode))

    def test_invalid_requests_do_not_load_dictionary(self):
        requests = [
            None, [], "private manuscript", 1, True, {},
            {"mode": "C"}, {"segments": []},
            make_request(extra="private manuscript"),
            *[make_request(mode=value) for value in ("D", "", None, [], {}, 1, True)],
            *[make_request(segments=value) for value in ("private manuscript", None, {}, 1)],
            *[make_request(segments=["private manuscript", value]) for value in (None, 1, True, [], {})],
            make_request(segments=["\ud800"]),
        ]
        for request in requests:
            with self.subTest(request=request):
                reply = bridge.handle(request)
                self.assert_failure(reply, "invalid_request")
                self.assertNotIn("private manuscript", reply["error"])
        self.assertEqual(sudachipy.DICTIONARIES, [])

    def test_byte_limit_skips_only_oversized_segment(self):
        at_limit = "あ" * 13333 + "a"
        over_limit = at_limit + "b"
        self.assertEqual(len(at_limit.encode("utf-8")), 40000)
        reply = bridge.handle(make_request(segments=["前", over_limit, at_limit, "後"]))
        self.assertTrue(reply["ok"])
        self.assertEqual(reply["segments"][1], {"error": "segment_too_long"})
        self.assertEqual(sudachipy.TEXTS, ["前", at_limit, "後"])
        self.assertEqual([entry["tokens"][0][0] for entry in
                          (reply["segments"][0], reply["segments"][3])], ["前", "後"])

    def test_tokenize_failure_does_not_stop_neighbours(self):
        text = "private manuscript\n" + sudachipy.TOKENIZE_MARKER
        reply = bridge.handle(make_request(segments=["前", text, "後"]))
        self.assertEqual(reply["segments"][1], {"error": "tokenize_failed"})
        self.assertEqual(sudachipy.TEXTS, ["前", text, "後"])
        self.assertEqual([reply["segments"][i]["tokens"][0][0] for i in (0, 2)], ["前", "後"])
        self.assertEqual(len(reply["pos"]), 1)

    def test_dictionary_and_create_failures(self):
        for flag in ("DICTIONARY_ERROR", "CREATE_ERROR"):
            with self.subTest(flag=flag), patch.object(sudachipy, flag, True):
                reply = bridge.handle(make_request(segments=["private manuscript"]))
                self.assert_failure(reply, "dictionary_failed")
                self.assertNotIn("private manuscript", reply["error"])
        self.assertEqual(sudachipy.TEXTS, [])

    def test_dictionary_exception_message_is_not_exposed(self):
        with patch.object(sudachipy, "Dictionary", side_effect=RuntimeError("private manuscript\nsecret")):
            reply = bridge.handle(make_request(segments=["private manuscript"]))
        self.assert_failure(reply, "dictionary_failed")
        self.assertNotIn("private manuscript", reply["error"])
        self.assertNotIn("secret", reply["error"])


if __name__ == "__main__":
    unittest.main()
