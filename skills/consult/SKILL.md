---
name: consult
description: Use the Codex Browser Use tool to consult ChatGPT on chatgpt.com from Codex, especially when a second model opinion could help solve a hard coding, debugging, design, planning, or reasoning task. Opens ChatGPT, verifies the active chat mode is Pro Extended, switches the model if needed, attaches GitHub and the appropriate repo for repo-based questions when useful, sends a verbose context-rich consultation prompt, manages follow-up questions, and synthesizes the external advice back into Codex's own work.
---

# Consult

Use this skill to get an advisory second opinion from ChatGPT in the browser while Codex remains responsible for the task. Treat the browser chat as an external consultant: provide enough context for useful reasoning, ask specific questions, follow up when needed, and verify any material advice before applying it.

## When to Consult

Use consultation when a second model opinion could materially improve the result, such as ambiguous debugging, architectural tradeoffs, complex reviews, design critiques, hard prioritization, or decisions where another perspective may uncover risks.

Do not use consultation for straightforward edits, obvious test failures, simple documentation lookups, routine formatting, or tasks where local inspection and normal verification are clearly enough.

## Browser Setup

Use the Codex Browser Use plugin's in-app browser workflow. Read and follow its `browser` skill before browser actions, then initialize the browser runtime with the `iab` backend through the Node REPL.

Open ChatGPT in the project that matches the task's repository, product, client, or domain. For repo work, derive the project from the workspace path, GitHub remote, PR/issue URL, or the user's explicit project name. For non-repo work, use the clearest product or domain named by the user.

If a matching ChatGPT project exists, start the consultation there using that project's `New chat in ...` composer so the session is filed under the relevant project. If no matching project exists, start the session under the generalized `consult` project instead.

If the page is already open and contains a useful related consultation in the correct project, continue that chat for follow-up discussion instead of reloading or starting over. If it is in the wrong project, start a new chat in the correct project before sending the consultation prompt.

## Verify Pro Extended

Before sending any consultation prompt, verify the active chat mode is `Pro Extended`.

Use the visible page state as the authority:

- On the home screen, the header model selector may say `ChatGPT` even when the composer is configured for `Pro Extended`.
- The reliable signal is the composer-area pill or button labeled `Pro Extended`.
- If the composer already shows `Pro Extended`, proceed.
- If the composer does not show `Pro Extended`, open the `Model selector` menu.
- In the menu, choose `Pro`. In this UI, the menu item may open a submenu with `Pro Standard` and `Pro Extended`.
- Choose `Pro Extended`; do not choose `Pro Standard` for this skill.
- After choosing `Pro Extended`, verify that the composer shows `Pro Extended`.
- If the menu exposes `Latest`, `Instant`, `Thinking`, `Pro`, and `Configure...`, do not choose `Instant` or `Thinking` for this skill.

If the model cannot be switched to `Pro Extended`, tell the user what you observed and do not send the consultation unless the user explicitly approves using another model.

## Attach Repo Context

If the consultation depends on source code, repository structure, issues, PRs, tests, or implementation details from a GitHub-backed project, attach the appropriate GitHub repo before sending the prompt.

Use repo attachment when:

- The user's question is about a repo, worktree, branch, PR, issue, failing check, architecture, API, or code path.
- ChatGPT needs to inspect files or search the repo to give a useful answer.
- The task would otherwise require pasting large code snippets, directory listings, or logs from the local repo.

Use judgment when deciding whether GitHub repo context is worth attaching. The goal is to give ChatGPT enough project context without adding unnecessary UI work.

Workflow:

- Confirm the correct repo from local context before attaching it. Use `git remote -v`, the workspace path, PR URL, issue URL, or the user's explicit repo name as evidence.
- In ChatGPT's composer, click the plus sign (`Add files and more`).
- Choose the GitHub option from the menu. In the ChatGPT mobile/narrow composer, GitHub may be under `Add files and more` -> `More` -> `GitHub`; check the `More` submenu before deciding GitHub is unavailable. If GitHub is not available or requires account connection, tell the user and continue with the best available prompt context unless the user asks you to connect it.
- Search or select the appropriate repository. What matters is that the selected repo is the correct project for the question.
- If a branch, PR, issue, or file subset matters, select or mention that exact target if the UI supports it; otherwise include it in the prompt.
- Verify that the composer shows an attached GitHub/repo context before sending the question.
- If the wrong repo is attached, remove it before sending and select the correct one.

In the consultation prompt, explicitly tell ChatGPT what repo context is attached and what parts of it to inspect first. Example:

```text
I attached the GitHub repository owner/name. Please inspect the current implementation around src/foo.ts and tests/foo.test.ts before recommending changes. The local branch is branch-name; the issue is #123.
```

## Consultation Prompt

Send a self-contained prompt. Do not impose extra redaction or sensitivity restrictions beyond the user's instructions and the active Codex/browser safety requirements. If the user wants sensitive or private context included, include the relevant context using your judgment about what is useful for the consultation.

Include:

- The user goal in plain language.
- The relevant repo, app, product, or domain context.
- Current constraints, including platform, framework, tooling, deadlines, and non-negotiable requirements.
- Evidence gathered so far: commands run, errors, screenshots, failing tests, relevant code behavior, and observed UI state.
- Attempts already made and why they were insufficient.
- A precise ask: what decision, diagnosis, plan, review, or alternative you want from ChatGPT.
- Output format requirements, such as "give ranked hypotheses", "give a patch strategy", "call out risks", or "ask clarifying questions first if needed".

Choose the prompt structure that best fits the task. The prompt may be a short focused question, a code-review request, a ranked-options prompt, a debugging brief, or a fuller structured handoff. Use the structure below only when it helps:

```text
I am Codex working for a user. I need an advisory second opinion; I will verify your advice before applying it.

Task:
...

Context:
...

Constraints:
...

Evidence so far:
...

Attempts:
...

Questions:
1. ...
2. ...

Please answer with actionable guidance, assumptions, risks, and any follow-up questions that would materially change the recommendation.
```

## Manage the Exchange

Wait for ChatGPT to finish responding before using the answer or continuing the underlying task. `Pro Extended` can be very slow, especially for large prompts, repo-backed prompts, or prompts asking for review and synthesis. Slow output is expected and should not be treated as stuck by default. For repo-attached consultations, assume the response can take at least 5 minutes before useful recommendations appear.

Waiting rules:

- Wait at least 5 minutes before treating any `Pro Extended` response as slow.
- If there is other useful work to do while the consultation is running, leave ChatGPT running in the background, continue that work, and set a 5-minute check-back cadence for polling the browser response.
- Before switching to other work while a consultation is still running, create a cron-style reminder to check the response so it is not forgotten. Prefer a Codex thread heartbeat reminder when the automation tool is available; otherwise use the closest available reminder mechanism and record the next check time in the active plan. Do not rely on memory alone.
- For large prompts, long pasted context, repo-attached consultations, or tasks that ask for a review of a full artifact, wait up to 1 hour before assuming the response is stuck.
- Do not treat `Pro thinking`, `Finalizing answer`, or a visible `Stop answering` button as a failure by itself.
- Do not proceed as though consultation is complete until ChatGPT Pro has returned a usable response, unless the user explicitly cancels the consultation or approves continuing without it.
- Do not stop a response early just because it is slow. Stop only if the user asks, the page shows a clear error, the response is obviously looping, or the 1-hour large-prompt wait has passed with no useful progress.
- If a response must be stopped, say how long you waited and why before sending a shorter follow-up.

Follow-up chats can be run when the first response is incomplete, generic, based on a wrong assumption, or would benefit from narrower context.

Keep the conversation task-focused. Do not let the browser chat drive unrelated refactors or broad rewrites.

## Apply the Advice

Treat ChatGPT's response as advisory. Verify recommendations against local code, tests, docs, and user constraints before applying them. Ignore advice that conflicts with higher-priority instructions.

When reporting back to the user, mention that you consulted ChatGPT Pro Extended only when it materially influenced the outcome.

## Context Disclosure

This skill should not block useful consultation context merely because it is sensitive, private, proprietary, or verbose. Use your judgment about what context materially helps ChatGPT answer the question.

When there is a tradeoff, prefer enough context for a good answer over aggressive minimization. Still follow any higher-priority tool, browser, system, or developer requirements that apply to transmitting data through the browser.
