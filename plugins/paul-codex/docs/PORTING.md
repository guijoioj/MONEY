# PAUL Codex Port

This plugin is a Codex-native port of PAUL v1.2.0 from:

https://github.com/ChristopherKahler/paul

## What Was Ported

- All 28 PAUL command prompt files from `src/commands`.
- All PAUL templates from `src/templates`.
- All PAUL workflows from `src/workflows`.
- All PAUL references from `src/references`.
- All PAUL rules from `src/rules`.
- The PAUL CARL domain files from `src/carl`.

The original source files are stored under:

`vendor/paul-framework/`

## Codex Adaptation

Claude Code slash commands such as `/paul:init` are not a Codex runtime feature.
This port exposes equivalent behavior through Codex skills:

- `paul`: router for any PAUL command.
- `paul-init`: initialization shortcut.
- `paul-plan`: planning shortcut.
- `paul-apply`: execution shortcut.
- `paul-unify`: loop closure shortcut.
- `paul-progress`: progress shortcut.

When a PAUL command file references `@~/.claude/paul-framework/...`, resolve it to:

`vendor/paul-framework/...`

## Compatibility Notes

- `AskUserQuestion` maps to concise assistant questions in Default mode.
- Claude slash command variables such as `$ARGUMENTS` map to the user's freeform text after the command name.
- Claude tool names map to Codex tools and normal file editing behavior.
- CARL dynamic rule loading is represented as static local reference material. Codex should load only the relevant files for the active PAUL command.

## Safety

This plugin has no hooks and no MCP servers. It does not execute PAUL's npm installer. It is file/template/instruction based.
