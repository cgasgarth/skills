---
name: typescript-lsp
description: Use the TypeScript 7 native LSP for semantic TypeScript or JavaScript navigation. Use for hover/type inspection, definitions, type definitions, implementations, and references. Prefer LSP over text search for semantic questions.
---

# TypeScript LSP

Run the bundled client with a TypeScript 7 `tsc` on `PATH`:

```bash
bun "$HOME/.codex/skills/typescript-lsp/scripts/query.mjs" hover FILE SEARCH [OCCURRENCE]
bun "$HOME/.codex/skills/typescript-lsp/scripts/query.mjs" definition FILE SEARCH [OCCURRENCE]
bun "$HOME/.codex/skills/typescript-lsp/scripts/query.mjs" type-definition FILE SEARCH [OCCURRENCE]
bun "$HOME/.codex/skills/typescript-lsp/scripts/query.mjs" implementation FILE SEARCH [OCCURRENCE]
bun "$HOME/.codex/skills/typescript-lsp/scripts/query.mjs" references FILE SEARCH [OCCURRENCE]
```

Use a one-based occurrence when `SEARCH` is not unique. Set `TS_LSP_TSC` only when the TypeScript 7 binary is not the `tsc` on `PATH`.

The helper is required because `tsc --lsp --stdio` is a raw LSP server, not a query CLI. It starts the server, initializes the workspace, opens the file, sends one request, and returns JSON.

TypeScript 7 can provide editor intelligence for a repository that builds with TypeScript 6. Use the repository's own compiler and package scripts for authoritative diagnostics and validation.
