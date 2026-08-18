---
name: typescript-lsp
description: Send generic requests to the TypeScript 7 native language server for TypeScript or JavaScript code intelligence, navigation, refactoring, formatting, diagnostics, completions, symbols, hierarchy, and editor features. Prefer LSP over text search for semantic questions.
---

# TypeScript LSP

Use the generic request client. Resolve `scripts/request.mjs` relative to this skill directory:

```bash
bun scripts/request.mjs FILE METHOD PARAMS_JSON
```

`FILE` anchors and opens the TypeScript project. `PARAMS_JSON` is the method's standard LSP params object; use `{}` when empty or `-` to read JSON from stdin. The client injects `textDocument.uri` when a text-document request omits it. LSP lines and characters are zero-based. Set `TS_LSP_TSC` only when the TypeScript 7 `tsc` is not on `PATH`.

Example:

```bash
bun scripts/request.mjs src/example.ts textDocument/hover \
  '{"position":{"line":41,"character":16}}'
```

## Advertised TypeScript 7.0.2 requests

- `textDocument/completion`
- `completionItem/resolve`
- `textDocument/hover`
- `textDocument/signatureHelp`
- `textDocument/definition`
- `textDocument/typeDefinition`
- `textDocument/implementation`
- `textDocument/references`
- `textDocument/documentHighlight`
- `textDocument/documentSymbol`
- `workspace/symbol`
- `textDocument/codeAction` with `quickfix`, `source.organizeImports`, `source.removeUnusedImports`, `source.sortImports`, and `source.fixAll`
- `textDocument/codeLens`
- `codeLens/resolve`
- `textDocument/formatting`
- `textDocument/rangeFormatting`
- `textDocument/onTypeFormatting`
- `textDocument/prepareRename`
- `textDocument/rename`
- `textDocument/foldingRange`
- `textDocument/selectionRange`
- `textDocument/prepareCallHierarchy`
- `callHierarchy/incomingCalls`
- `callHierarchy/outgoingCalls`
- `textDocument/linkedEditingRange`
- `textDocument/semanticTokens/full`
- `textDocument/semanticTokens/range`
- `textDocument/inlayHint`
- `textDocument/diagnostic` (document pull only; no workspace diagnostics)
- `workspace/willRenameFiles`

TypeScript-specific extensions:

- `custom/textDocument/sourceDefinition`
- `custom/textDocument/multiDocumentHighlight`
- `textDocument/_vs_onAutoInsert`
- `textDocument/_vs_references`

The client manages `initialize`, `initialized`, `textDocument/didOpen`, `shutdown`, and `exit`. See the [LSP 3.18 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/) for each params and result type.

TypeScript 7 can provide editor intelligence for a repository that builds with TypeScript 6. Use the repository's own compiler and package scripts for authoritative validation.
