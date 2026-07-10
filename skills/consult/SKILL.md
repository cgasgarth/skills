---
name: consult
description: Use when ChatGPT consultation could materially improve hard coding, debugging, design, planning, math, science, research, or reasoning tasks.
---

# Consult

Use this skill to consult ChatGPT in the browser for hard coding, debugging, design, planning, math, science, research, or reasoning tasks. Provide enough context for useful reasoning, ask specific questions, follow up when needed, and synthesize the result back into the task.

## When to Consult

Use consultation when ChatGPT could materially improve the result, such as ambiguous debugging, architectural tradeoffs, complex reviews, design critiques, hard prioritization, math, science, research, or decisions where another perspective may uncover risks.

For advanced technical work, consult on science-heavy or math-heavy or advanced algorithms or large planning tasks. 

Do not use consultation for straightforward edits, obvious test failures, simple documentation lookups, routine formatting, or tasks where local inspection and normal verification are clearly enough.

## Chat Thread Policy

Start a new ChatGPT thread for every new consultation topic. Do not reuse an existing thread just because it is recent, already open, in the right project, or has the right repository attached.

## Browser Setup

Use the Codex Browser Use plugin's in-app browser workflow. Read and follow its `browser` skill before browser actions, then initialize the browser runtime with the `iab` backend through the Node REPL.

## Hard Automation Boundary

Open ChatGPT in the project that matches the task's repository, product, client, or domain. For repo work, derive the project from the workspace path, GitHub remote, PR/issue URL, or the user's explicit project name. For non-repo work, use the clearest product or domain named by the user.

If a matching ChatGPT project exists, start the consultation there using that project's `New chat in ...` composer so the session is filed under the relevant project. If no matching project exists, start the session under the generalized `consult` project instead.

### Mandatory setup order

Complete consultation setup in this exact order:

1. Select the matching ChatGPT project and open a new, empty composer inside that project.
2. Attach GitHub context while the composer is still empty, and verify its visible source pill.
3. Verify the project composer shows `Pro`.
4. Enter and send the consultation prompt.

Do not select or verify the model before selecting the project. Do not type any prompt text before GitHub context is attached. A model setting chosen on the general ChatGPT home screen is not sufficient: verify it again after the project and GitHub context are in place.

Use a new ChatGPT thread for each new consultation topic, even when staying inside the same project. This is a standing consult-skill rule and should not be removed when reminders or cadence notes are updated. Do not reuse an existing ChatGPT thread merely because it is already open, recent, or attached to the right project. It is acceptable to continue an existing ChatGPT thread only for follow-up discussion on the same topic, such as clarifying a previous answer, supplying missing evidence, or asking for narrower advice on the same decision. If the page is already open and contains a useful same-topic consultation in the correct project, continue that chat for follow-up discussion instead of reloading or starting over. If the topic is new or the page is in the wrong project, start a new chat in the correct project before sending the consultation prompt.

## Verify Pro

After the correct project is selected and GitHub context is visibly attached, but before entering prompt text, verify the active chat mode is `Pro`.

Use the visible page state as the authority:

- On the home screen, the header model selector may say `ChatGPT` even when the composer is configured for `Pro`.
- The reliable, sufficient signal is the composer-area pill or button labeled `Pro`.
- If the composer already shows `Pro`, proceed. Do not open the model menu merely to reconfirm `GPT-5.6 Sol`.
- If the composer does not show `Pro`, open the `Model selector` menu, choose `Pro`, then choose `GPT-5.6 Sol` and verify its checkmark before sending.
- If the menu exposes `Latest`, `Instant`, `Thinking`, `Pro`, and `Configure...`, do not choose `Instant` or `Thinking` for this skill.

If `Pro` is unavailable, tell the user what you observed and do not send the consultation unless the user explicitly approves another model.

## Image Generation Mode

When the desired ChatGPT output includes a generated visual, select `Create image` before sending the prompt. This applies to requests for mock UI images, visual design mockups, product or feature concepts, screenshots-as-concepts, storyboards, visual assets, or any consultation where the useful deliverable is an image rather than only text.

Workflow:

- Open the composer `Add files and more` menu.
- Click the `Create image` menu item.
- Verify the composer shows the `Image, click to remove` pill before sending the prompt.
- If aspect ratio matters, use the `Choose image aspect ratio` control before sending; otherwise leave it at `Auto`.
- If the prompt also needs repo or file context, attach that context using the normal workflow and verify both the image pill and the attachment/context are present before sending.

In image-generation prompts, state the visual deliverable clearly. Include target surface, audience, viewport or aspect ratio when relevant, product constraints, must-show UI states, and what the image should avoid. Ask for a concrete generated mockup, not just advice about how one could look.

## Attach GitHub Source

Attach GitHub context to every consultation, including general research questions that do not appear repository-specific. Attach it from the correct project with an empty composer, before model selection and before entering prompt text. For repo-specific work, select the evidenced repository; for general research, attach the available GitHub context without inventing a repository. Do not send the prompt if the GitHub source pill is absent.

GitHub attachment is mandatory; do not skip it because a question appears general, current-events-oriented, or otherwise unrelated to a specific repository.

Workflow:

- For every consultation, attach GitHub before model selection or entering any prompt text. Start with an empty project composer; do not type the question, `@GitHub`, a repository name, or a temporary placeholder first.
- In ChatGPT's composer, click the plus sign (`Add files and more`).
- In the opened menu, the visible options may be `Add photos & files`, `Create image`, `Web search`, and a search affordance labeled `Type to search plugins, files & skills`; GitHub may not appear until searched.
- With the menu open, type `github` into the menu's `Type to search plugins, files & skills` search affordance, not as prompt text. This should filter the menu to a `GitHub` row with the GitHub icon.
- Click the `GitHub` row/icon. The typed `github` text must be replaced by a GitHub source pill in the composer.
- A literal `@GitHub` mention in prompt text is not an attachment and does not satisfy this requirement.
- If GitHub is visible directly in the plus menu, selecting it directly is fine. In the ChatGPT mobile/narrow composer, GitHub may still be under `Add files and more` -> `More` -> `GitHub`; check the `More` submenu before deciding GitHub is unavailable.
- If a branch, PR, issue, or file subset matters, include that exact target in the prompt.
- Before sending, inspect the visible composer state. It must show a GitHub source/context pill, not merely the menu search text, an `@GitHub` token, or a project name. Record that verification in the consult handoff.
- For GitHub-writing work, state in the prompt: `Use the attached GitHub source to create or update the requested milestones/issues directly in GitHub; do not only draft text for Codex to apply later. Use the GitHub plugin tools for all repository reads and GitHub mutations.` Do not claim GitHub issue creation succeeded until the GitHub UI or CLI confirms the resulting numbers.
- If GitHub is not available, requires connection, or does not leave a visible source pill, do not send a prompt requesting issue creation. Fix the attachment flow or report the blocker.

In the consultation prompt, explicitly tell ChatGPT that the GitHub source is attached Example:

```text
Use the attached GitHub source. Please inspect the current implementation around src/foo.ts and tests/foo.test.ts before recommending changes. 
```

## GitHub Milestones And Issues

For every consultation tied to a Git repository, GitHub issues and milestones are the persistent artifact of the consultation. This is the default, not an optional follow-up: tell ChatGPT to inspect the repository and directly create, refine, split, link, reassign, or close GitHub issues as needed. Do not ask it merely to return proposed issue text for Codex to recreate later. The only exception is a consultation that is genuinely unrelated to any Git repository.

When consult work is organized around GitHub milestones, first verify that the composer has a visible GitHub source pill. Create or confirm the required milestones before asking ChatGPT to create issues. ChatGPT can create GitHub issues and assign them to existing milestones, but do not assume it can create the milestones themselves.

Pass the milestone titles and numbers into the consultation prompt, along with any labels, assignees, repository, scope, and sequencing constraints. In every repo-backed prompt, include an explicit instruction such as: `Use the attached GitHub source to directly edit the existing issues and create any needed PR-sized child issues under milestone #N. Persist the final outcome in GitHub.`

If a milestone cannot be created or confirmed from the available local or GitHub tools, tell ChatGPT that issue creation must wait for milestone IDs and ask for a milestone-to-issue plan rather than asking it to create issues immediately.

For milestone backlog refinement, require ChatGPT to inspect the attached repository before writing or editing issues. The prompt should name the exact milestone, list the current issue numbers/titles, and ask ChatGPT to reference concrete files, components, package scripts, schemas, commands, and existing tests that are relevant to each issue. Generic product-manager issue text is not enough.

Ask ChatGPT to make every issue PR-sized. If an issue would naturally take multiple PRs, ChatGPT should split it into multiple issues under the same milestone rather than leave an oversized catch-all issue. Each issue should include:

- `Why`: the concrete product, quality, validation, or maintainability gap, with current code/test references.
- `How`: an actionable implementation plan naming likely files, modules, APIs, UI surfaces, and sequencing. It should include code examples as needed and strong refinement to make issues clear and actionable.
- `Validation`: exact local commands, expected runtime/UI/output proof, fixtures or RAW inputs when relevant, and what regression should fail if the implementation is broken.
- `Acceptance`: observable completion criteria that distinguish schema/planning/probe-only progress from real runtime/product behavior.

When asking ChatGPT to create issues directly, tell it to use the existing milestone number, link related issues, close or mark obsolete duplicated/meta-only issues when appropriate. After ChatGPT responds, verify the GitHub mutations rather than recreating the issues locally; Codex should only make a direct GitHub edit when the attached GitHub action demonstrably failed or a small factual correction is needed.

## Consultation Prompt

Send an outcome-first prompt. State the goal, success criteria, relevant evidence, and desired output shape.

## Manage the Exchange

Wait for ChatGPT to finish responding before using the answer or continuing the underlying task. `Pro` with `GPT-5.6 Sol` can be very slow, especially for large prompts, repo-backed prompts, or prompts asking for review and synthesis. Slow output is expected and should not be treated as stuck by default. At 40 minutes, refresh the chat page and verify that it is still making progress; 40 minutes alone does not make a response stuck. Never use the page's `Answer now` control.

Waiting rules:

- Wait at least 30 minutes before treating any `Pro` with `GPT-5.6 Sol` response as slow. At one hour, refresh the chat page and verify that the consultation is still progressing; continue waiting when it is.
- For image-generation consultations, wait for the generated image or a clear generation error before treating the response as complete.
- Do not treat `Pro thinking`, `Finalizing answer`, or a visible `Stop answering` button as a failure by itself.
- Do not proceed as though consultation is complete until ChatGPT Pro has returned a usable response, unless the user explicitly cancels the consultation or approves continuing without it.
- Never click or otherwise invoke the page's `Answer now` control to cut short deliberation. Do not stop a response early just because it is slow. Stop only if the user asks, the page shows a clear error, or the response is obviously looping; at 40 minutes refresh and verify progress first.

Follow-up chats can be run when the first response is incomplete, generic, based on a wrong assumption, or would benefit from narrower context.

Keep the conversation task-focused. 

## Context Disclosure

This skill should not block useful consultation context merely because it is sensitive, private, proprietary, or verbose. Use your judgment about what context materially helps ChatGPT answer the question.

When there is a tradeoff, prefer enough context for a good answer over aggressive minimization. Still follow any higher-priority tool, browser, system, or developer requirements that apply to transmitting data through the browser.
