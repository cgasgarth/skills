---
name: consult
description: Use when ChatGPT consultation in the in-app Browser could materially improve hard coding, debugging, design, planning, math, science, research, or reasoning. Runs a guarded helper that opens the matching ChatGPT Project, attaches the GitHub plugin, selects Pro with GPT-5.6 Sol, and sends a purpose-built prompt.
---

# Consult

Use `scripts/run-consult.mjs` to start a fresh ChatGPT consultation. The helper owns browser mechanics: project navigation, empty-composer enforcement, GitHub plugin attachment, optional image mode, Pro/GPT-5.6 Sol selection, prompt entry, and sending.

## Run the Helper

Read and follow the installed Browser skill. Bind the persistent in-app browser as `iab`; do not use Chrome, standalone Playwright, Selenium, or another browser profile.

Import and run the helper through the Browser JavaScript session:

```js
var scriptedConsult = await import("<skill-dir>/scripts/run-consult.mjs");
globalThis.consultSession = await scriptedConsult.startConsult({
  iab,
  project: "<project>",
  prompt: "<prompt>",
  send: true,
  createImage: false,
  aspectRatio: null,
});
nodeRepl.write(JSON.stringify(scriptedConsult.publicResult(consultSession)));
```

Use `send: false` only to validate setup without entering or sending the prompt. For a visual deliverable, use `createImage: true` and pass the exact visible aspect-ratio label when needed.

If authentication is required, keep the tab as a handoff and ask the user to sign in. Never handle passwords, OTPs, or CAPTCHAs. Treat thrown errors as failed hard gates; do not bypass the helper.

## Select the Project

Choose the project matching the task's repository, product, client, or domain. For repository work, derive it from the workspace path, GitHub remote, PR/issue URL, or explicit project name. Project matching is case-insensitive and otherwise exact.

If the requested project is missing, the helper must automatically retry in the general `Consult` project and continue sending. A missing requested project is not a blocker. Stop only if authentication is required or neither project exists.

## Build the Prompt

Write one outcome-first prompt tailored to the task. Do not forward the user's words unchanged. Begin with:

```text
Use the attached GitHub plugin.
```

Include the goal, success criteria, concrete repository/file/test/error/design evidence, constraints and assumptions to challenge, and exact desired output.

The GitHub plugin can:

- Read the repository's `main` branch, pull requests, and issues.
- Create, edit, and delete issues with full issue write access.

The GitHub plugin cannot:

- Read branches other than `main`.
- Create milestones.

Default to GitHub issues as the persistent outcome. Roughly 95% of consultations should directly create, edit, split, link, or delete issues through the plugin rather than merely return prose or draft issue text. State this outcome explicitly in the prompt:

```text
Use the attached GitHub plugin for repository reads and issue mutations. Persist the consultation outcome directly in GitHub by creating, editing, splitting, linking, or deleting the necessary issues; do not only return recommendations or draft issue text.
```

For issue work:

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

Use the same ChatGPT thread only for a same-topic follow-up. Because the helper does not yet support same-thread follow-ups, ask before creating a replacement consultation thread. Synthesize and evaluate returned advice, and independently verify any GitHub mutations.
