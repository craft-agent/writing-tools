"""A deterministic, package-owned SudachiPy substitute; no dictionary needed."""

from enum import Enum

DICTIONARY_ERROR = False
CREATE_ERROR = False
TOKENIZE_MARKER = "[tokenize-failed]"
DICTIONARIES = []
MODES = []
TEXTS = []
POS = {
    "kanji": ("名詞", "普通名詞", "一般", "*", "*", "*"),
    "hiragana": ("助詞", "格助詞", "*", "*", "*", "*"),
    "katakana": ("名詞", "普通名詞", "外来語", "*", "*", "*"),
    "latin": ("名詞", "普通名詞", "英数字", "*", "*", "*"),
    "other": ("補助記号", "一般", "*", "*", "*", "*"),
}


class SplitMode(Enum):
    """Distinct values let tests check that create receives the enum member."""

    A = "A"
    B = "B"
    C = "C"


def script(char: str) -> str:
    """Classify just the script ranges needed by these tests."""
    if "\u4e00" <= char <= "\u9fff" or "\U00020000" <= char <= "\U0002ffff":
        return "kanji"
    if "\u3040" <= char <= "\u309f":
        return "hiragana"
    if "\u30a0" <= char <= "\u30ff":
        return "katakana"
    if char.isascii() and char.isalnum():
        return "latin"
    return "other"


class Morpheme:
    """One script run, with code-point offsets and distinguishable forms."""

    def __init__(self, text: str, begin: int, end: int):
        """Keep the run and its position in the original segment."""
        self.text = text[begin:end]
        self.start = begin
        self.stop = end

    def surface(self):
        """Return the unchanged run."""
        return self.text

    def begin(self):
        """Return its code-point start."""
        return self.start

    def end(self):
        """Return its exclusive code-point end."""
        return self.stop

    def part_of_speech(self):
        """Return six tags shared by runs of this script."""
        return POS[script(self.text[0])]

    def normalized_form(self):
        """Use lowercase to distinguish normalization from surface."""
        return self.text.lower()

    def dictionary_form(self):
        """Make dictionary-form column swaps visible."""
        return "dictionary:" + self.text

    def reading_form(self):
        """Make reading-form column swaps visible."""
        return "reading:" + self.text


class Tokenizer:
    """Split text into maximal runs of the same script."""

    def tokenize(self, text: str):
        """Record calls and fail with input-bearing text at the test marker."""
        TEXTS.append(text)
        if TOKENIZE_MARKER in text:
            raise RuntimeError(text)
        result = []
        begin = 0
        for end in range(1, len(text) + 1):
            if end == len(text) or script(text[end]) != script(text[begin]):
                result.append(Morpheme(text, begin, end))
                begin = end
        return result


class Dictionary:
    """Record constructor and create arguments, with independent failure hooks."""

    def __init__(self, *, dict: str):
        """Accept the explicit dictionary selection the real engine requires."""
        DICTIONARIES.append(dict)
        if DICTIONARY_ERROR:
            raise RuntimeError("dictionary failed")

    def create(self, *, mode: SplitMode):
        """Record the selected mode and return one tokenizer."""
        MODES.append(mode)
        if CREATE_ERROR:
            raise RuntimeError("create failed")
        return Tokenizer()
