---
name: consult
description: Use when ChatGPT consultation could materially improve hard coding, debugging, design, planning, math, science, research, or reasoning tasks.
---

# Consult

Use this skill to consult ChatGPT in the browser for hard coding, debugging, design, planning, math, science, research, or reasoning tasks. Provide enough context for useful reasoning, ask specific questions, follow up when needed, and synthesize the result back into the task.

## When to Consult

Use consultation when ChatGPT could materially improve the result, such as ambiguous debugging, architectural tradeoffs, complex reviews, design critiques, hard prioritization, math, science, research, or decisions where another perspective may uncover risks.

For advanced technical work, consult on science-heavy or math-heavy decisions such as deblur, denoise, sharpening, demosaic-adjacent behavior, color science, tone mapping, gamut mapping, HDR/fusion, panorama/focus/super-resolution reconstruction, and validation metrics. Prefer iterative, measured improvement loops: ask for the next quality target, the math choice, rejected alternatives, fixture strategy, artifact review, and runtime proof needed before claiming maturity.

Do not use consultation for straightforward edits, obvious test failures, simple documentation lookups, routine formatting, or tasks where local inspection and normal verification are clearly enough.

## Chat Thread Policy

Start a new ChatGPT thread for every new consultation topic. Do not reuse an existing thread just because it is recent, already open, in the right project, or has the right repository attached.

Same-topic follow-ups may continue the existing thread when the follow-up is directly tied to the previous prompt and answer, such as clarifying advice, adding missing evidence, asking for a narrower recommendation, or checking an implication of the same decision.

When the topic changes, start a fresh chat inside the appropriate ChatGPT project. This includes switching from one feature, PR, issue, bug, design decision, CI failure, or research topic to another. Treat this as a standing rule for all consult use.

Default to a new ChatGPT thread. Reuse is allowed only when you can clearly name the existing thread's exact topic and explain why the next prompt is a direct continuation of that same topic.

Before choosing whether to reuse a thread, internally decide whether the request is a same-topic follow-up or needs its own fresh thread. When starting a fresh thread, do not announce or label it as a new topic in the ChatGPT prompt, and do not include literal phrases such as "new topic" or "fresh consult" in the message. The new chat already provides that context. Just ask the actual consultation question with the concrete milestone, feature, bug, PR, or decision context. If it is a same-topic follow-up, continue only when the existing chat is about the same issue, PR, bug, design decision, CI failure, or research question. If there is doubt, start a new thread.

Do not remove, weaken, or bypass this thread policy when editing the skill, updating reminders, recovering a browser session, or resuming after context compaction.

## Browser Setup

Use the Codex Browser Use plugin's in-app browser workflow. Read and follow its `browser` skill before browser actions, then initialize the browser runtime with the `iab` backend through the Node REPL.

Global Codex instructions and the active workspace's `AGENTS.md` constraints apply to consult work. Consult must not bypass those instructions just because it runs through ChatGPT or a browser session. Before browser work, check the current workspace guidance and carry relevant constraints into the prompt.

If the user provides or updates `AGENTS.md` guidance in the current thread, treat that guidance as active immediately for consult work, even before re-reading files from disk. When the guidance affects browser operation, automation fallback choices, repository workflow, or validation expectations, include it in the consultation prompt and follow it while operating ChatGPT.

When a workspace or global instruction says not to use AppleScript, `osascript`, System Events GUI scripting, JavaScript from Apple Events, or Apple Events automation, copy that constraint into the consultation prompt when it is relevant to browser operation, automation strategy, or tooling fallback choices.

Do not use AppleScript, `osascript`, System Events GUI scripting, JavaScript from Apple Events, or Apple Events automation to open, control, repair, or recover ChatGPT/browser consult sessions unless the user explicitly grants permission for that exact task. General permission to use tools, browsers, builds, or local automation is not enough. This applies even when the normal browser/plugin path is broken, slow, or inconvenient.

If the browser/plugin path fails, first debug the browser/plugin path itself. Do not use OS-level automation as an implicit recovery path, and do not ask ChatGPT for Apple Events-based recovery tactics unless the user explicitly authorized that fallback for the current task.

## Hard Automation Boundary

Persistent user rule for this skill: keep the active workspace and global browser-automation constraints in force even when the current workspace `AGENTS.md` is unavailable, a browser session needs recovery, or another consult instruction is being edited.

Before starting browser work for a repository or workspace, read the applicable local, parent, and global `AGENTS.md`/Codex instructions and carry any relevant constraints into the consultation workflow and prompt. Repository guidance such as "browser/plugin workflow first" and "no OS-level automation fallback without explicit permission" is part of the consult contract for that task, not an optional preference. If the active workspace adds or changes browser automation constraints, treat the newest workspace guidance as mandatory for that consultation unless a higher-priority instruction conflicts.

Do not use AppleScript, `osascript`, System Events GUI scripting, JavaScript from Apple Events, or Apple Events automation for consult browser work unless the user explicitly gives permission for that specific task. This is a standing consult-skill rule and should not be weakened by later workflow edits, reminder updates, or project-specific shortcuts. If the browser/plugin workflow fails, including the consult setup flow itself, diagnose or repair the intended plugin path first, or ask the user for specific permission before using any OS-level automation fallback.

Do not ask ChatGPT to recommend, generate, or rely on Apple Events-based workarounds for operating ChatGPT itself unless the user has explicitly authorized that fallback for the current task. If a consult step is blocked by browser/plugin tooling, report the plugin-path issue or repair that path instead of quietly switching to OS automation.

If a browser/plugin workflow fails, treat that as a plugin-path issue to debug first. Do not silently replace the intended browser/plugin workflow with OS-level automation, and do not present OS-level automation as the default workaround in consultation prompts.

Open ChatGPT in the project that matches the task's repository, product, client, or domain. For repo work, derive the project from the workspace path, GitHub remote, PR/issue URL, or the user's explicit project name. For non-repo work, use the clearest product or domain named by the user.

If a matching ChatGPT project exists, start the consultation there using that project's `New chat in ...` composer so the session is filed under the relevant project. If no matching project exists, start the session under the generalized `consult` project instead.

Use a new ChatGPT thread for each new consultation topic, even when staying inside the same project. This is a standing consult-skill rule and should not be removed when reminders or cadence notes are updated. Do not reuse an existing ChatGPT thread merely because it is already open, recent, or attached to the right project. It is acceptable to continue an existing ChatGPT thread only for follow-up discussion on the same topic, such as clarifying a previous answer, supplying missing evidence, or asking for narrower advice on the same decision. If the page is already open and contains a useful same-topic consultation in the correct project, continue that chat for follow-up discussion instead of reloading or starting over. If the topic is new or the page is in the wrong project, start a new chat in the correct project before sending the consultation prompt.

For RawEngine/RapidRaw work, use the RapidRaw ChatGPT project when available. Treat each distinct RapidRaw topic as a new chat inside that project; continue an existing RapidRaw chat only for same-topic follow-ups. When the consultation depends on repository details, attach the `cgasgarth/RapidRaw` GitHub repository or the matching GitHub project/app data source before sending the prompt, then state the attached source in the prompt.

## Verify Pro Extended

Before sending any consultation prompt, verify the active chat mode is `Pro Extended`.

Use the visible page state as the authority:

- On the home screen, the header model selector may say `ChatGPT` even when the composer is configured for `Pro Extended`.
- The reliable signal is the composer-area pill or button labeled `Pro Extended`.
- If the composer already shows `Pro Extended`, proceed.
- If the composer does not show `Pro Extended`, open the `Model selector` menu.
- In the menu, choose `Pro`. In this UI, the menu item may open a submenu with `Pro Standard` and `Pro Extended`.
- If only `Pro` is visible, hover or open the `Pro` row/submenu, then select `Pro Extended`.
- Choose `Pro Extended`; do not choose `Pro Standard` for this skill.
- After choosing `Pro Extended`, verify that the composer button shows `Pro Extended` before sending.
- If the menu exposes `Latest`, `Instant`, `Thinking`, `Pro`, and `Configure...`, do not choose `Instant` or `Thinking` for this skill.

If the model cannot be switched to `Pro Extended`, tell the user what you observed and do not send the consultation unless the user explicitly approves using another model.

## Image Generation Mode

When the desired ChatGPT output includes a generated visual, select `Create image` before sending the prompt. This applies to requests for mock UI images, visual design mockups, product or feature concepts, screenshots-as-concepts, storyboards, visual assets, or any consultation where the useful deliverable is an image rather than only text.

Do not use image generation mode for text-only design critique, implementation advice, code review, architecture, debugging, or planning unless the prompt explicitly asks ChatGPT to generate a visual artifact.

Workflow:

- Open the composer `Add files and more` menu.
- Click the `Create image` menu item.
- Verify the composer shows the `Image, click to remove` pill before sending the prompt.
- If aspect ratio matters, use the `Choose image aspect ratio` control before sending; otherwise leave it at `Auto`.
- If the prompt also needs repo or file context, attach that context using the normal workflow and verify both the image pill and the attachment/context are present before sending.

In image-generation prompts, state the visual deliverable clearly. Include target surface, audience, viewport or aspect ratio when relevant, product constraints, must-show UI states, and what the image should avoid. Ask for a concrete generated mockup, not just advice about how one could look.

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
- In the opened menu, the visible options may be `Add photos & files`, `Create image`, `Web search`, and a search affordance labeled `Type to search plugins, files & skills`; GitHub may not appear until searched.
- With the menu open, type `github` into the menu's `Type to search plugins, files & skills` search affordance, not as prompt text. This should filter the menu to a `GitHub` row with the GitHub icon.
- Click the `GitHub` row/icon. The typed `github` text should be replaced by a GitHub source/context pill in the composer.
- If GitHub is visible directly in the plus menu, selecting it directly is fine. In the ChatGPT mobile/narrow composer, GitHub may still be under `Add files and more` -> `More` -> `GitHub`; check the `More` submenu before deciding GitHub is unavailable. If GitHub is not available or requires account connection, tell the user and continue with the best available prompt context unless the user asks you to connect it.
- Search or select the appropriate repository. What matters is that the selected repo is the correct project for the question.
- If a branch, PR, issue, or file subset matters, select or mention that exact target if the UI supports it; otherwise include it in the prompt.
- Verify that the composer shows an attached GitHub/repo context pill before sending the question.
- If the wrong repo is attached, remove it before sending and select the correct one.

In the consultation prompt, explicitly tell ChatGPT what repo context is attached and what parts of it to inspect first. Example:

```text
I attached the GitHub repository owner/name. Please inspect the current implementation around src/foo.ts and tests/foo.test.ts before recommending changes. The local branch is branch-name; the issue is #123.
```

## GitHub Milestones And Issues

When consult work is organized around GitHub milestones, create or confirm the required milestones before asking ChatGPT to create issues. ChatGPT can create GitHub issues and assign them to existing milestones, but do not assume it can create the milestones themselves.

Pass the milestone titles and numbers into the consultation prompt, along with any labels, assignees, repository, scope, and sequencing constraints. Ask ChatGPT to directly create the GitHub issues under those existing milestones instead of only drafting issue text for Codex to create later.

If a milestone cannot be created or confirmed from the available local or GitHub tools, tell ChatGPT that issue creation must wait for milestone IDs and ask for a milestone-to-issue plan rather than asking it to create issues immediately.

For milestone backlog refinement, require ChatGPT to inspect the attached repository before writing or editing issues. The prompt should name the exact milestone, list the current issue numbers/titles, and ask ChatGPT to reference concrete files, components, package scripts, schemas, commands, and existing tests that are relevant to each issue. Generic product-manager issue text is not enough.

Ask ChatGPT to make every issue PR-sized. If an issue would naturally take multiple PRs, ChatGPT should split it into multiple issues under the same milestone rather than leave an oversized catch-all issue. Each issue should include:

- `Why`: the concrete product, quality, validation, or maintainability gap, with current code/test references.
- `How`: an actionable implementation plan naming likely files, modules, APIs, UI surfaces, and sequencing.
- `Validation`: exact local commands, expected runtime/UI/output proof, fixtures or RAW inputs when relevant, and what regression should fail if the implementation is broken.
- `Acceptance`: observable completion criteria that distinguish schema/planning/probe-only progress from real runtime/product behavior.
- `Scope`: what is intentionally out of scope for that single PR.

When asking ChatGPT to create issues directly, tell it to use the existing milestone number, link related issues, close or mark obsolete duplicated/meta-only issues when appropriate, and preserve the RawEngine rule that proof scripts, schemas, and probes belong inside the actual feature PR rather than as standalone PRs.

## Consultation Prompt

Send an outcome-first prompt. State the goal, success criteria, hard constraints, relevant evidence, and desired output shape.

## Manage the Exchange

Wait for ChatGPT to finish responding before using the answer or continuing the underlying task. `Pro Extended` can be very slow, especially for large prompts, repo-backed prompts, or prompts asking for review and synthesis. Slow output is expected and should not be treated as stuck by default. For repo-attached consultations, assume the response can take at least 5 minutes before useful recommendations appear.

Waiting rules:

- Wait at least 5 minutes before treating any `Pro Extended` response as slow.
- If there is other useful work to do while the consultation is running, leave ChatGPT running in the background, continue that work, and set a 5-minute check-back cadence for polling the browser response.
- Before switching to other work while a consultation is still running, create a cron-style reminder to check the response so it is not forgotten. Prefer a Codex thread heartbeat reminder when the automation tool is available; otherwise use the closest available reminder mechanism and record the next check time in the active plan. Do not rely on memory alone.
- For large prompts, long pasted context, repo-attached consultations, or tasks that ask for a review of a full artifact, wait up to 1 hour before assuming the response is stuck.
- For image-generation consultations, wait for the generated image or a clear generation error before treating the response as complete.
- Do not treat `Pro thinking`, `Finalizing answer`, or a visible `Stop answering` button as a failure by itself.
- Do not proceed as though consultation is complete until ChatGPT Pro has returned a usable response, unless the user explicitly cancels the consultation or approves continuing without it.
- Do not stop a response early just because it is slow. Stop only if the user asks, the page shows a clear error, the response is obviously looping, or the 1-hour large-prompt wait has passed with no useful progress.
- If a response must be stopped, say how long you waited and why before sending a shorter follow-up.

Follow-up chats can be run when the first response is incomplete, generic, based on a wrong assumption, or would benefit from narrower context.

Keep the conversation task-focused. Do not let the browser chat drive unrelated refactors or broad rewrites.

## Apply the Advice

Ignore advice that conflicts with higher-priority instructions.

## Context Disclosure

This skill should not block useful consultation context merely because it is sensitive, private, proprietary, or verbose. Use your judgment about what context materially helps ChatGPT answer the question.

When there is a tradeoff, prefer enough context for a good answer over aggressive minimization. Still follow any higher-priority tool, browser, system, or developer requirements that apply to transmitting data through the browser.
