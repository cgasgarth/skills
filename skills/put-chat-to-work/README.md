# Set up ChatGPT Chat for repository work

This is a human setup guide, not an installable skill. It contains no project-specific skill, account IDs, private workspace links or runtime bundles. Create your own private instructions and assets for the repository you want ChatGPT to work on.

## How it works

An internet-connected preparation machine packages source, dependencies and runtime files. A private shared folder stores these reusable assets. ChatGPT Chat uses connected apps to obtain the files and, when execution tools are available, runs the project in its Linux sandbox. Repository CI validates the final pull-request commit.

This setup is useful for implementation and PR work. Read-only reviews and investigations often need only repository access.

## 1. Check accounts and capabilities

Connect your repository provider and file-storage provider in ChatGPT. Verify the connected account, repository access, folder access and available write tools. A shared browser profile does not prove connector authorization. Repository access, file access, project membership and skill access are separate.

Start a fresh Chat-mode session and ask it to inspect its actual tools and execution environment. Check OS/architecture, command execution, raw-file download support, outbound networking, loopback networking and package-install permissions. These capabilities vary by account, policy and session.

Keep source and assets private. Share only with the people and connected accounts that need access. Exclude real cloud credentials, Git tokens, private keys and machine-local environment files from archives.

## 2. Create a durable asset workspace

Use one private folder with a stable layout:

```text
Repository workspace/
  START-HERE.md
  WORKSPACE.json
  Source/<commit-sha>/
  Infrastructure/Runtime/<version>/
  Infrastructure/Dependencies/<dependency-key>/
  Infrastructure/Services/<version>/
  Recipes/<version>/
  Validation/<commit-sha>/
```

`START-HERE.md` explains project setup and validation. `WORKSPACE.json` selects compatible manifests and the recipe. Keep these files' IDs stable. Publish new asset versions in separate folders and update the index after upload verification.

Each manifest should record source SHA, platform, component versions, ordered input hashes, build/install options, archive size and SHA-256. For split archives, record each part's order, size, hash and file ID. If you copy a workspace, update the copied manifests: old file IDs still point to the original assets.

## 3. Prepare compatible source and dependencies

1. Resolve the target ref to an immutable SHA. Export tracked source with a tool such as `git archive`. Inspect it for credentials and unrelated files.
2. Compute a deterministic dependency key from lockfiles, root/workspace manifests, runtime pins, install configuration, dependency patches, target OS/architecture and install options. Record the key algorithm and ordered input hashes.
3. Install locked dependencies in a clean staging checkout for the sandbox's platform. Prefer a native Linux build host. Include native optional packages, preserve workspace links, and record whether install scripts ran.
4. Package the language runtime and browser binaries separately. Match browser revisions to the installed test framework. Do not supply macOS binaries for a Linux sandbox.
5. Test runtime startup and representative native imports on compatible Linux before upload.

Source archives are a bootstrap. They can be somewhat stale if the repository connector can reconstruct the complete target tree. Dependencies must match that tree. Refresh dependency bundles when their key changes; refresh runtimes when versions, browser revisions, platform or required native libraries change. Never claim current-branch validation from a partially refreshed checkout.

Keep runtimes outside source so linting and file discovery do not scan vendor files. Put only matching dependencies inside the checkout; do not overlay an older dependency tree.

## 4. Transfer and verify assets

Check the connected storage tool's actual raw-download limits. Split large archives when needed. Parts of at most 80,000,000 bytes worked in one tested configuration; this is a transfer convention, not a universal product limit.

Upload parts first, verify their sizes and destination folders, then publish the manifest. In ChatGPT, download raw files, verify each part, concatenate in manifest order, verify the combined hash, and extract into a fresh directory. Check archive paths and symlinks before extraction.

Keep archives, installed dependencies, logs and runtime binaries out of public skills/documentation repositories.

## 5. Supply native services when Docker is unavailable

Inspect the project's real service requirements. If it can use native processes, package compatible database servers/extensions, caches, service emulators and required shared libraries. Record trusted upstream sources, versions and hashes. A container on the preparation machine can build native files without requiring a container in the receiving sandbox.

Inspect the receiving environment before installing packages. Install only missing compatible dependencies. Use a non-root account for services that require it, private data directories, unused loopback ports and local test credentials. Do not replace real databases/storage with fake implementations and claim equivalent integration coverage.

Verify each service first: database connection and extension query, cache health, emulator health and representative operations. Then run actual migrations, seed data and application readiness checks.

Uploading Docker or VM software cannot grant missing kernel capabilities. If the canonical test command requires Docker Compose, document native execution as a separate workflow. Keep canonical CI validation as a distinct requirement.

## 6. Build an executable setup recipe

Package the launcher, every required helper, one configuration example and a human README together. Missing helpers must cause an error rather than silently skip setup. Declare prerequisites such as installed system packages and extracted source/runtime directories.

The recipe should:

- Initialize an owned test database and service state when needed.
- Start actual services/apps with bounded health and readiness checks.
- Provision local emulator resources from the project's configuration.
- Run database tests in an isolated disposable database.
- Restore clean migrated/seeded state before browser tests, or use a separate browser-test database.
- Generate authentication state with the repository's own test code.
- Set the complete test-run context, including required ports, paths and session fields. Partial context can allocate ports different from the running apps.
- Run unchanged test projects, capture exits/timing, and clean up only owned resources.

Extract the packaged recipe into a new directory and run that copy. Syntax checks alone do not prove it works. Save actual logs, counts, failures, source SHA and runtime versions. State whether validation reused installed packages or included fresh download/installation.

## 7. Create your own private instructions

If Skills are available, create a private ChatGPT skill for implementation and PR work. Write repository-specific instructions; this guide deliberately includes no ready-made skill body.

Identify the repository and private asset workspace. Direct ChatGPT to the live guide/index, require a pinned target SHA and compatible assets, explain local validation, and define PR completion. Require checks on the latest PR head, inspection and repair of failed CI jobs, and a final PR URL, SHA and validation summary. Define how to return a patch if write tools are unavailable. Keep merge/deployment permissions separate from PR creation.

If you use a local coding-agent launcher, keep account-specific skill IDs and folder links in local configuration. Do not publish them as a generic installable skill.

Use the product's skill-selection UI and verify the structured skill attachment. Typing a skill name is not proof of attachment. In the tested UI, trying a skill inserted a sample prompt and could select Work mode. Replace the sample prompt and verify the intended skill, project and model.

**Immediately before every send, including follow-ups, verify in the current UI that Chat is selected and Work is not selected.** Do not infer mode from the URL, model, project or skill chip. Switch to Chat if needed and recheck attachments. If mode cannot be verified, do not send yet.

Start with a setup-only smoke test that makes no source changes or PR. After it passes, request a small implementation task. Wait for each response to finish before follow-ups. Use a quiet scheduled check near expected completion for long browser tasks instead of continuous polling. Stop monitoring after completion and avoid duplicate tasks after connection interruptions.

## What ChatGPT.com Chat mode may access

These are observed Chat-mode behaviors from September 2026, not guarantees for every plan, workspace or future session. Verify available tools in a fresh session.

| Resource | Observed access and boundary |
| --- | --- |
| Skill/project context | Attached instructions and selected project context could guide work. Fresh chats still needed asset selection and setup. |
| Repository connector | Could read private source, PRs and CI evidence, and publish changes when tools and permissions allowed. It did not automatically provide an authenticated local checkout. |
| Storage connector | Could retrieve raw archives/text and upload or replace files when authorized. File-size limits could require splitting. |
| Linux execution | Available execution tools could run shell commands, edit sandbox files, build code, launch browsers and run native services. Check OS, architecture and package permissions. |
| Network | Connectors could work while direct repository/registry downloads from the sandbox did not. These are separate capabilities. |
| Integration tests | Real databases, caches, service emulators and application/browser tests could run from supplied Linux assets with project-specific setup. |
| Docker/VMs | A usable daemon or required kernel privileges were not assured. Native services were a separate tested option. |
| Your computer | Chat did not inherit the local coding agent's checkout, filesystem, terminal, browser cookies or running services. Supply files through authorized uploads/connectors. |
| Persistence | Files could survive interrupted turns while processes did not. Verify live processes, ports and readiness; saved PID files are not proof. Use storage for durable handoff. |

Do not infer Chat-mode capabilities from another product surface. OpenAI's [Work overview](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview) describes Work's local/cloud execution and account-dependent controls; it does not establish identical Chat-mode capabilities.

## Completion standard

For each implementation task, verify target source and asset compatibility, run appropriate local checks, and inspect CI on the final PR commit. A historical setup pass, older green CI run or partially refreshed checkout does not prove a new change is correct. Report remaining gaps and update the reusable guide when capabilities or workflow assumptions change.
