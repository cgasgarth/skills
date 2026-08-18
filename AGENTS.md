# Global Codex Instructions

- Keep routine command, script, hook, poll, and validation output concise: compact summaries on success, bounded actionable excerpts on failure.
- Make text shown in Codex threads extremely information-dense; prefer terse, high-signal phrasing and clear shorthand where it preserves meaning.
- For repeated noisy commands, prefer compact wrappers or summary modes so unchanged success output stays small.
- Installed CLIs include `sr`, `sg` (`ast-grep`), `rg`, `git`, `gh`, `bun`, `bunx`, `uv`, and `uvx`; use them where useful to improve efficiency, productivity, and output quality.
- For inline one-off JavaScript or TypeScript commands, prefer `bun` or `bunx` over `node` or `npx` when available.

## Python tooling

- Use the uv ecosystem for Python versions, environments, dependencies, tools, and commands.
- For projects, prefer `uv add`, `uv remove`, `uv sync`, `uv lock`, and `uv run`. Keep dependencies in `pyproject.toml` and commit `uv.lock` when the project uses a lockfile.
- For one-off dependencies and tools, prefer `uv run --with <package>` and `uvx <tool>`.
- For Python versions and virtual environments, prefer `uv python` and `uv venv`. Use uv-managed Python for new environments.
- Do not use `pip`, `pip3`, `python -m pip`, `pipx`, or Homebrew to install Python interpreters, libraries, or Python CLI tools unless the user explicitly requests it or uv cannot support the requirement. If uv cannot support it, explain why before using another installer.

## Code Mode batching

Within each bounded stage, group multiple already-known, independent,
non-conflicting tool calls into one `exec` cell and run them concurrently.

In Code Mode, within each bounded stage, run independent, functions.exec-available tool calls concurrently in one functions.exec call. Use await Promise.allSettled([...]) when partial results are useful, and inspect every result; use await Promise.all([...]) only when any failure should abort the batch. Keep dependencies, waits/resumes, approvals, conflicting or interdependent mutations, and adaptive investigations where each result may change the next step sequential. Do not split otherwise batchable inspections across outer tool calls.

## Engineering Principles

- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Trust official SDK types at SDK-controlled boundaries. Use exported package types and functions directly. Do not duplicate their contracts or add runtime validation, defensive parsing, or broad casts unless data crosses an untrusted boundary or the SDK documents the value as untyped.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

Always talk in ASD-STE100 Simplified Technical English.
