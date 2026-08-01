---
name: consult
description: Use when ChatGPT consultation in the in-app Browser could materially improve hard coding, debugging, design, planning, math, science, research, or reasoning. Runs a guarded helper that opens the matching ChatGPT Project, attaches the GitHub plugin by default, selects Pro with GPT-5.6 Sol, and sends a purpose-built prompt.
---

# Consult

Do not use this skill to review pull requests unless the user explicitly asks to use `consult` for the PR review.

Use `scripts/run-consult.mjs` to start a fresh ChatGPT consultation. The helper owns browser mechanics: project navigation, empty-composer enforcement, GitHub plugin attachment, optional image mode, thinking-level/model selection, prompt entry, and sending.

## Run the Helper

Read and follow the installed Browser skill. Bind the persistent in-app browser as `iab`; do not use Chrome, standalone Playwright, Selenium, or another browser profile.

Import and run the helper through the Browser JavaScript session:

```js
var scriptedConsult = await import("<skill-dir>/scripts/run-consult.mjs");
globalThis.consultSession = await scriptedConsult.startConsult({
  iab,
  project: "<project>",
  prompt: "<prompt>",
  paths: ["/full/system/path/to/file-or-folder"],
  send: true,
  createImage: false,
  aspectRatio: null,
  thinkingLevel: "pro",
  attachGitHub: true,
});
nodeRepl.write(JSON.stringify(scriptedConsult.publicResult(consultSession)));
```

The helper attaches GitHub by default. Pass `attachGitHub: false` to leave the plugin unattached; in that mode, omit GitHub-specific instructions from the prompt.

`paths` is optional and accepts one absolute system path or an array of absolute paths. Files are uploaded from private temporary snapshots so later filesystem changes cannot cross the limit; their bytes and names stay unchanged unless duplicate names need numeric suffixes. Folders are automatically ZIP archived. Every upload obeys a hard 512 MB per-file limit; oversized folders become numbered ZIP archives, and an individual file that cannot fit becomes numbered ZIP chunk archives with reconstruction manifests. Multiple prepared files are uploaded together. The helper removes temporary copies and archives after ChatGPT accepts them.

To add files or an optional follow-up prompt to the already-open consultation, reuse the session instead of starting a new thread:

```js
globalThis.consultFollowUp = await scriptedConsult.sendToExistingConsult({
  session: consultSession,
  paths: ["/full/system/path/to/file-or-folder"],
  prompt: "<optional follow-up prompt>",
  send: true,
});
nodeRepl.write(JSON.stringify(scriptedConsult.publicResult(consultFollowUp)));
```

Omit `prompt` to send only the attachments. Pass `send: false` to prepare the existing composer without submitting it. The helper refuses to overwrite an existing draft.

Use `send: false` only to validate setup without typing or sending the prompt. When `paths` are supplied, the files remain attached to the unsent draft. For a visual deliverable, use `createImage: true` and pass the exact visible aspect-ratio label when needed.

`thinkingLevel` defaults to `"pro"`, which selects Pro with GPT-5.6 Sol. Only choose a non-pro thinking level (`"instant"`, `"medium"`, `"high"`, or `"extra-high"`) when the user explicitly requests it.

If authentication is required, keep the tab as a handoff and ask the user to sign in. Never handle passwords, OTPs, or CAPTCHAs. Treat thrown errors as failed hard gates; do not bypass the helper.

## Select the Project

Choose the project matching the task's repository, product, client, or domain. For repository work, derive it from the workspace path, GitHub remote, PR/issue URL, or explicit project name. Project matching is case-insensitive and otherwise exact.

If the requested project is missing, the helper must automatically retry in the general `Consult` project and continue sending. A missing requested project is not a blocker. Stop only if authentication is required or neither project exists.

## Build the Prompt

Write one outcome-first prompt tailored to the task. Do not forward the user's words unchanged. When GitHub is attached (the default), begin with:

```text
Use the attached GitHub plugin.
```

Include the goal, success criteria, concrete repository/file/test/error/design evidence, constraints and assumptions to challenge, and exact desired output.

When GitHub is attached, the GitHub plugin can:

- Read the repository's `main` branch, pull requests, and issues.
- Create, edit, and delete issues with full issue write access.

When GitHub is attached, the GitHub plugin cannot:

- Read branches other than `main`.
- Create milestones.

When GitHub is attached, default to GitHub issues as the persistent outcome. Roughly 95% of consultations should directly create, edit, split, link, or delete issues through the plugin rather than merely return prose or draft issue text. State this outcome explicitly in the prompt:

```text
Use the attached GitHub plugin for repository reads and issue mutations. Persist the consultation outcome directly in GitHub by creating, editing, splitting, linking, or deleting the necessary issues; do not only return recommendations or draft issue text.
```

For issue work when GitHub is attached:

- Require inspection of `main`, relevant pull requests, and existing issues before mutation.
- Make each issue PR-sized; split work requiring multiple PRs.
- Require `Why`, `How`, `Validation`, and observable `Acceptance` criteria with concrete code/test references.
- Pass repository, issue numbers, labels, assignees, sequencing, and related-issue constraints when known.
- Verify resulting issue numbers and mutations after ChatGPT responds.

For milestone work, create or confirm milestones outside ChatGPT first, then pass their existing titles and numbers in the prompt. If milestone IDs are unavailable, request a milestone-to-issue plan and forbid issue mutations until the IDs are supplied.

For visual output, specify the target surface, audience, aspect ratio, required states, product constraints, and exclusions. Ask for a concrete generated visual, not advice about making one.

Preserve the user's intent and do not broaden external mutations without authorization. Include enough useful private or proprietary context for a strong answer while obeying higher-priority restrictions on credentials, personal data, and other protected information.

## Handle the Result

The helper ends immediately after sending and must not poll, refresh, extract the response, or click `Answer now`. Preserve its live tab and URL.

When the task requires ChatGPT's answer, wait outside the helper through the normal Browser workflow. Pro can be slow: do not treat it as slow before 30 minutes; refresh and verify progress at 40 minutes and again at one hour. Never invoke `Answer now` or stop a response merely because it is slow.

Use `sendToExistingConsult` for same-topic follow-ups in the current ChatGPT thread. Start a new consultation for a new topic. Synthesize and evaluate returned advice, and independently verify any GitHub mutations.
