---
name: paul
description: Use PAUL Plan-Apply-Unify workflows in Codex. Route requests such as paul:init, paul:plan, paul:apply, paul:unify, paul:progress, and all other PAUL commands to the ported PAUL command/workflow files.
---

# PAUL for Codex

This is a Codex-native adapter for PAUL. Use it when the user mentions PAUL, `/paul:*`, `paul:*`, Plan-Apply-Unify, or asks for the PAUL workflow.

## Resource Root

All PAUL source material lives at:

`../../vendor/paul-framework/`

Resolve original Claude references as follows:

- `@~/.claude/paul-framework/commands/X.md` -> `../../vendor/paul-framework/commands/X.md`
- `@~/.claude/paul-framework/workflows/X.md` -> `../../vendor/paul-framework/workflows/X.md`
- `@~/.claude/paul-framework/templates/X.md` -> `../../vendor/paul-framework/templates/X.md`
- `@~/.claude/paul-framework/references/X.md` -> `../../vendor/paul-framework/references/X.md`
- `@~/.claude/paul-framework/rules/X.md` -> `../../vendor/paul-framework/rules/X.md`

## Command Routing

Supported PAUL commands from the original package:

`add-phase`, `apply`, `assumptions`, `audit`, `complete-milestone`, `config`, `consider-issues`, `discover`, `discuss-milestone`, `discuss`, `flows`, `handoff`, `help`, `init`, `map-codebase`, `milestone`, `pause`, `plan-fix`, `plan`, `progress`, `register`, `remove-phase`, `research-phase`, `research`, `resume`, `status`, `unify`, `verify`.

If the user says `/paul:init` or `paul init`, open:

`../../vendor/paul-framework/commands/init.md`

Then open only the workflow/template/reference files directly listed in that command's `execution_context`.

## Codex Runtime Adaptation

- Treat `$ARGUMENTS` as the text after the PAUL command in the user's message.
- Replace Claude `AskUserQuestion` with a concise direct question to the user. Ask one question at a time.
- Use Codex file editing rules. Use `apply_patch` for manual edits.
- Do not use subagents unless the user explicitly asks for subagents or parallel agent work.
- Do not execute npm installers.
- Do not write to `~/.claude`.
- Keep `.paul/` project state in the current project unless the user explicitly chooses another path.

## Core Loop

PAUL's required loop is:

1. PLAN: create a plan with acceptance criteria.
2. APPLY: execute the approved plan.
3. UNIFY: create summary, reconcile state, close the loop.

Never skip UNIFY when working inside an active PAUL loop.

## When Files Are Missing

If `.paul/` does not exist and the user asks for planning/apply/progress, route to `init` first or explain that initialization is required.

If a command references a resource that cannot be found, report the missing path and continue with the closest available workflow.
