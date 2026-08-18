---
name: typescript-lsp
description: Query project-local TypeScript 7 language-server code intelligence before reading or changing TypeScript or JavaScript. Use for symbol definitions, type definitions, implementations, references, hover/type inspection, document or workspace symbols, and diagnostics in .ts, .tsx, .js, .jsx, .mts, .cts, .mjs, and .cjs files. Prefer this skill over text search when the question is semantic; use text search only when LSP cannot answer.
---

# TypeScript LSP

Use `scripts/ts_lsp.mjs` to query the project-local TypeScript 7 server through `tsc --lsp --stdio`.

## Workflow

1. Resolve the exact file and symbol position.
2. Run the narrowest LSP query that answers the question.
3. Treat LSP locations and types as primary evidence.
4. Read only the returned files and ranges needed for the task.
5. Fall back to `rg` only when LSP returns no useful result or the question is textual rather than semantic.

Do not claim that a query used LSP unless the script completed successfully.

## Commands

Set the helper path once in each shell command:

```bash
TS_LSP_SKILL="$HOME/.codex/skills/typescript-lsp/scripts/ts_lsp.mjs"
```

Identify a symbol by exact text. `--occurrence` is one-based and defaults to `1`:

```bash
bun "$TS_LSP_SKILL" definition --file src/example.ts --search 'targetSymbol'
bun "$TS_LSP_SKILL" references --file src/example.ts --search 'targetSymbol' --occurrence 2
bun "$TS_LSP_SKILL" hover --file src/example.ts --search 'targetSymbol'
bun "$TS_LSP_SKILL" type-definition --file src/example.ts --search 'targetSymbol'
bun "$TS_LSP_SKILL" implementation --file src/example.ts --search 'targetSymbol'
```

Identify a position with one-based line and column values:

```bash
bun "$TS_LSP_SKILL" hover --file src/example.ts --line 42 --column 17
```

Query file or project structure:

```bash
bun "$TS_LSP_SKILL" document-symbols --file src/example.ts
bun "$TS_LSP_SKILL" workspace-symbols --file src/example.ts --query 'TargetClass'
bun "$TS_LSP_SKILL" diagnostics --file src/example.ts
bun "$TS_LSP_SKILL" capabilities --root .
```

The helper finds the nearest project-local `node_modules/.bin/tsc`, requires TypeScript 7 or later, finds the Git root by default, and emits JSON. Use `--root PATH`, `--tsc PATH`, or `--timeout MS` only when automatic resolution is wrong.

## Query selection

- Use `definition` to find where a value, function, class, type alias, or interface is declared.
- Use `type-definition` to find the declared type behind a value.
- Use `implementation` to find concrete implementations of interfaces or abstract members.
- Use `references` before renames, signature changes, or deletion.
- Use `hover` for the resolved type, signature, documentation, and overload information.
- Use `document-symbols` or `workspace-symbols` to navigate by semantic symbol name. Give `workspace-symbols` a file in the target TypeScript project so the server loads the correct configuration.
- Use `diagnostics` for language-server errors and warnings. Run the repository validation command separately before completion.

## Failure handling

- If no TypeScript 7 binary is found, inspect the project install state. Do not install or upgrade dependencies unless the user asked.
- If the symbol text is ambiguous, select a more exact string or provide `--occurrence`, `--line`, and `--column`.
- If the server returns `null` or an empty list, verify the position, then use a related LSP query before falling back to `rg`.
- If project loading times out, retry once with a larger `--timeout`; report the failed LSP query if it still fails.
