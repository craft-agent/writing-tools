"""Analyze one UTF-8 JSON request with SudachiPy, without keeping its text.

Input is {"mode":"C","segments":["…"]}; modes A, B and C are supported.
The one-line reply holds ok, a deduplicated six-field pos table and segments
of compact token arrays, or ok=false with kind and a fixed short error.
Each token holds surface, code-point begin/end, pos id, normalized form,
dictionary form and reading. Segment failures do not stop other segments.
An unexpected crash before a reply exits 1 with a short stderr message; only
the exception type is shown, never its text.
"""

import json
import sys

MAX_SEGMENT_BYTES = 40000
MODES = ("A", "B", "C")


def failure(kind: str, error: str) -> dict:
    """Build a failure whose message never includes request or exception text."""
    return {"ok": False, "kind": kind, "error": error}


def handle(request: object) -> dict:
    """Validate and analyze a request, loading the dictionary once."""
    if not isinstance(request, dict) or set(request) != {"mode", "segments"}:
        return failure("invalid_request", "expected mode and segments")
    mode, segments = request["mode"], request["segments"]
    if not isinstance(mode, str) or mode not in MODES:
        return failure("invalid_request", "mode must be A, B or C")
    if not isinstance(segments, list) or not all(isinstance(text, str) for text in segments):
        return failure("invalid_request", "segments must be a list of strings")
    try:
        sizes = [len(text.encode("utf-8")) for text in segments]
    except UnicodeEncodeError:
        return failure("invalid_request", "segments must contain valid Unicode")

    try:
        from sudachipy import Dictionary, SplitMode
    except ImportError:
        return failure("engine_missing", "SudachiPy is not available")
    try:
        tokenizer = Dictionary(dict="core").create(mode=getattr(SplitMode, mode))
    except Exception:
        return failure("dictionary_failed", "the core dictionary could not be loaded")

    pos = []
    pos_ids = {}
    results = []
    for text, size in zip(segments, sizes):
        if size > MAX_SEGMENT_BYTES:
            results.append({"error": "segment_too_long"})
            continue
        try:
            morphemes = tokenizer.tokenize(text)
        except Exception:
            results.append({"error": "tokenize_failed"})
            continue
        tokens = []
        for morpheme in morphemes:
            tags = tuple(morpheme.part_of_speech())
            if tags not in pos_ids:
                pos_ids[tags] = len(pos)
                pos.append(list(tags))
            tokens.append([
                morpheme.surface(),
                morpheme.begin(),
                morpheme.end(),
                pos_ids[tags],
                morpheme.normalized_form(),
                morpheme.dictionary_form(),
                morpheme.reading_form(),
            ])
        results.append({"tokens": tokens})
    return {"ok": True, "pos": pos, "segments": results}


def main() -> int:
    """Read bytes and write one compact UTF-8 reply, independent of locale."""
    try:
        try:
            request = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            request = None
        line = json.dumps(handle(request), separators=(",", ":"), ensure_ascii=False)
        data = (line + "\n").encode("utf-8")
    except Exception as exc:
        sys.stderr.write(f"the bridge crashed: {type(exc).__name__}\n")
        return 1
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
