---
name: consult
description: Use when ChatGPT consultation in the in-app Browser could materially improve hard coding, debugging, design, planning, math, science, research, or reasoning tasks. Runs a guarded helper against the persistent Browser session to open the matching ChatGPT Project, attach GitHub, verify Pro with GPT-5.6 Sol, enter the prompt, and send it.
---

# Consult

Use this skill to consult ChatGPT through the bundled `scripts/run-consult.mjs` helper and the persistent in-app Browser. Provide enough context for useful reasoning, ask specific questions, follow up when needed, and synthesize the result back into the task.

This skill is self-contained. Do not load or invoke another consultation skill to complete its workflow.

## When to Consult

Use consultation when ChatGPT could materially improve the result, such as ambiguous debugging, architectural tradeoffs, complex reviews, design critiques, hard prioritization, math, science, research, or decisions where another perspective may uncover risks.

For advanced technical work, consult on science-heavy or math-heavy work, advanced algorithms, or large planning tasks.

Do not consult for straightforward edits, obvious test failures, simple documentation lookups, routine formatting, or tasks where local inspection and normal verification are clearly enough.

## Chat Thread Policy

Start a new ChatGPT thread for every new consultation topic. Do not reuse an existing thread merely because it is recent, open, in the right project, or has the right repository attached.

Continue an existing thread only for follow-up discussion on the same topic, such as clarifying a previous answer, supplying missing evidence, or requesting narrower advice. Until the helper supports an explicit same-thread URL, report that limitation rather than silently creating a new thread for a requested follow-up.

## Browser and Helper Setup

Read and follow the installed Browser skill. Initialize its runtime, explicitly bind the persistent in-app browser as `iab`, and read the complete `iab` documentation before browser actions. Do not use Chrome, standalone Playwright, Selenium, or a separate browser profile.

Import the helper through the JavaScript browser-control session:

```js
var scriptedConsult = await import("<skill-dir>/scripts/run-consult.mjs");
```

Create the consultation and retain its live session object:

```js
globalThis.consultSession = await scriptedConsult.startConsult({
  iab,
  project: "<project>",
  prompt: "<prompt>",
  send: true,
});
nodeRepl.write(JSON.stringify(scriptedConsult.publicResult(consultSession)));
```

The user's request to run the consultation authorizes sending the prepared task prompt. Use `send: false` only to test setup without entering or sending it.

If authentication is required, keep the in-app tab as a handoff, ask the user to sign in there, and continue only after they say it is ready. Never handle passwords, OTPs, or CAPTCHAs.

## Project Selection and Fallback

Open ChatGPT in the project matching the task's repository, product, client, or domain. For repo work, derive the project from the workspace path, GitHub remote, PR/issue URL, or the user's explicit project name. For non-repo work, use the clearest named product or domain.

Project matching is case-insensitive and otherwise exact. The helper opens the matched project's home and its `New chat in ...` composer; it never reuses a prior chat for a new topic.

If the helper returns `project_not_found`, do not fall back automatically. Ask exactly: `I couldn't find the ChatGPT project “<requested>”. Should I use the general Consult project instead?` Retry with `project: "Consult"` only after the user agrees.

Treat every thrown error as a failed hard gate. Report it and do not enter or submit the prompt through another route.

## Mandatory Setup Order

The helper must complete this exact order:

1. Select the matching project and open a new, empty project composer.
2. Attach GitHub context while the composer is empty and verify its visible source pill.
3. If requested, enable image-generation mode and verify its visible pill.
4. Verify the project composer shows `Pro` or select `Pro` and `GPT-5.6 Sol`.
5. Enter and send the consultation prompt.

Do not select or verify the model before selecting the project. Do not type prompt text before the GitHub source is visibly attached. A model setting selected on the general ChatGPT home screen is insufficient.

## Verify Pro

Use visible project-composer state as the authority:

- A composer-area pill or button labeled `Pro` is reliable and sufficient. If present, proceed without opening the model menu.
- Otherwise select `Pro`, then `GPT-5.6 Sol`, and verify `Pro` is visible before entering the prompt.
- Never select `Instant` or `Thinking` for this workflow.

If Pro is unavailable, report the failure and do not send unless the user explicitly approves another model. The helper currently fails closed rather than selecting an alternate model.

## Image Generation Mode

When the requested ChatGPT output is a generated visual, pass `createImage: true`. This applies to mock UI images, visual design mockups, concepts, screenshots-as-concepts, storyboards, or other image deliverables.

If an aspect ratio matters, also pass its exact visible label as `aspectRatio: "<label>"`; otherwise leave it null for Auto. The helper verifies the image-mode pill before sending and fails closed if it is missing.

In image prompts, specify the target surface, audience, viewport or aspect ratio, product constraints, required states, and exclusions. Ask for a concrete generated mockup, not advice about how one could look.

## Attach GitHub Source

**Hard gate:** prose is never an attachment. Every consultation must contain the structured GitHub source/context pill created through the composer picker. A repository URL, name, `@GitHub`, or text saying to use GitHub does not satisfy this requirement.

Attach GitHub to every consultation, including general research. For repo work, name the evidenced repository, branch, PR, issue, or file subset in the prompt. For general research, attach the available GitHub context without inventing a repository.

Before sending, require visible evidence of the GitHub source pill. In the handoff, state that the helper verified the pill before prompt entry and immediately before send. If the helper does not provide that evidence, report the consultation as not sent.

For GitHub-writing work, include:

```text
Use the attached GitHub source to create or update the requested milestones/issues directly in GitHub; do not only draft text for Codex to apply later. Use the GitHub plugin tools for all repository reads and GitHub mutations.
```

Do not claim GitHub mutation succeeded until the GitHub UI, connector, or CLI confirms the resulting artifact identifiers.

If GitHub is unavailable, requires connection, or fails to leave a visible pill, do not send. Report the helper's failure.

Begin consultation prompts with an explicit source statement, for example:

```text
Use the attached GitHub source. Inspect the current implementation around src/foo.ts and tests/foo.test.ts before recommending changes.
```

## GitHub Milestones and Issues

For every repository-backed consultation, use GitHub issues and milestones as the persistent artifact. Tell ChatGPT to inspect the repository and directly create, refine, split, link, reassign, or close issues as needed. Do not ask it merely to return issue text for Codex to recreate. The exception is work genuinely unrelated to a Git repository.

Create or confirm required milestones before the consultation. Do not assume ChatGPT can create milestones. Pass milestone titles and numbers, labels, assignees, repository, scope, and sequencing constraints into the prompt.

If a milestone cannot be created or confirmed, tell ChatGPT issue creation must wait for milestone IDs and request a milestone-to-issue plan instead.

For milestone backlog refinement, name the exact milestone and current issue numbers/titles. Require concrete references to relevant files, components, package scripts, schemas, commands, and tests. Generic product-management text is insufficient.

Make every issue PR-sized. Split work requiring multiple PRs into multiple issues under the same milestone. Require each issue to include:

- `Why`: the concrete product, quality, validation, or maintainability gap with current code/test references.
- `How`: an actionable implementation plan naming likely files, modules, APIs, UI surfaces, sequencing, and code examples where useful.
- `Validation`: exact commands, runtime/UI/output proof, fixtures or raw inputs, and the regression expected to fail if broken.
- `Acceptance`: observable criteria distinguishing planning or schema progress from real runtime/product behavior.

Tell ChatGPT to use the existing milestone number, link related issues, and close or mark obsolete duplicated/meta-only issues when appropriate. Afterward, verify GitHub mutations rather than recreating them locally. Make a direct correction only when the attached GitHub action demonstrably failed or a small factual fix is needed.

## Consultation Prompt

Update the consultation prompt for the actual task rather than forwarding the user's words unchanged. Make it outcome-first and include:

- The goal and concrete success criteria.
- Relevant repository, file, test, error, design, or research evidence.
- Constraints, assumptions, and decisions that must be challenged.
- The exact output shape needed.
- The explicit attached-GitHub instruction.
- Direct GitHub mutation instructions when applicable.

Preserve the user's intent. Do not broaden requested external mutations without authorization.

## Manage the Exchange

The helper's responsibility ends immediately after clicking `Send prompt`. It must not poll, refresh, extract the response, click `Answer now`, or otherwise manage ChatGPT's answer. Preserve the returned live tab and URL.

When the surrounding task requires the answer, manage waiting outside the helper through the normal Browser workflow. Wait for ChatGPT to finish before using the answer or continuing the underlying task, and keep the user updated at least once per minute. Never infer completion from elapsed time alone.

`Pro` with `GPT-5.6 Sol` can be very slow. Follow these rules:

- Wait at least 30 minutes before treating a response as slow.
- At 40 minutes, refresh once and verify progress; 40 minutes alone is not stuck.
- At one hour, refresh again and continue waiting when progress remains visible.
- Never invoke `Answer now`.
- Do not treat `Pro thinking`, `Finalizing answer`, or a visible stop button as failure.
- For image consultations, wait for the generated image or a clear generation error.
- Do not proceed as though consultation completed until a usable response returns, unless the user cancels or explicitly approves continuing without it.
- Stop only when the user asks, the page shows a clear error, the response obviously loops, or the configured response timeout expires.

Use a follow-up on the same topic when the first response is incomplete, generic, or based on a wrong assumption. Because the helper does not yet support same-thread follow-ups, report that limitation and ask before creating a replacement consultation thread.

Keep the exchange task-focused. Synthesize the consultation result; do not merely paste it back without evaluation.

## Context Disclosure

Do not block useful context merely because it is sensitive, private, proprietary, or verbose. Use judgment about what materially helps ChatGPT answer.

Prefer enough context for a useful answer over aggressive minimization, while following higher-priority rules governing transmission of passwords, authentication material, personal data, or other protected information.
