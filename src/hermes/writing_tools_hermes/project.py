"""The plugin's identity and constants that differ between tool packages."""

from __future__ import annotations

#: The plugin's name: used as a log prefix, approval rule key prefix and Hermes toolset prefix.
PLUGIN_NAME = "writing-tools"

#: The built command-line name used in error and log messages.
CLI_NAME = "writing-tools-cli"

#: The prefix skills start with: skills named ``<SKILL_PREFIX><topic>`` are registered without it.
SKILL_PREFIX = "writing-"

#: The emoji each toolset is shown with.
TOOLSET_EMOJI: dict[str, str] = {"text": "✍️"}

#: The settings the tools themselves read: each snake_case name and a type (``text``, ``boolean``, ``number``,
#: ``list``, ``path`` or ``paths``) or a dict with ``type`` and optional bounds (``integer``, ``min``, ``max``,
#: ``values``), as in ``src/project.ts``. Write OPTIONS on one line with double quotes. A setting ``a_b`` becomes
#: ``--a-b``.
OPTIONS: dict[str, str | dict[str, object]] = {"state_dir": "path", "register": {"type": "text", "values": ["document", "polite", "plain"]}, "latin_spacing": {"type": "text", "values": ["document", "spaced", "unspaced"]}, "unit_spacing": {"type": "text", "values": ["document", "spaced", "unspaced"]}, "alnum_width": {"type": "text", "values": ["document", "halfwidth", "fullwidth"]}, "bracket_width": {"type": "text", "values": ["document", "fullwidth", "halfwidth"]}, "punctuation": {"type": "text", "values": ["document", "ten_maru", "comma_period", "comma_maru"]}, "quotes": {"type": "text", "values": ["document", "corner", "double"]}, "range_mark": {"type": "text", "values": ["document", "wave_dash", "fullwidth_tilde", "hyphen"]}, "long_vowel": {"type": "text", "values": ["document", "keep", "drop"]}, "counter_ka": {"type": "text", "values": ["document", "hiragana", "small_ke", "katakana"]}, "rules": "list", "exclude_rules": "list", "sentence_length": {"type": "number", "integer": True, "min": 20, "max": 400}, "kanji_run": {"type": "number", "integer": True, "min": 4, "max": 20}, "no_chain": {"type": "number", "integer": True, "min": 2, "max": 10}}

__all__ = [
    "CLI_NAME",
    "OPTIONS",
    "PLUGIN_NAME",
    "SKILL_PREFIX",
    "TOOLSET_EMOJI",
]
