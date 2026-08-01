import { prepareUploadPaths } from "./prepare-uploads.mjs";

const CHATGPT_URL = "https://chatgpt.com/";
const FALLBACK_PROJECT = "Consult";

function normalized(value) {
  return String(value).normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

async function requireOne(locator, description) {
  const count = await locator.count();
  if (count !== 1) throw new Error(`Expected exactly one ${description}; found ${count}.`);
  return locator;
}

async function visible(locator) {
  const count = await locator.count();
  return count === 1 && await locator.isVisible();
}

async function actualProjectLabel(tab, requested) {
  const wanted = normalized(requested);
  const labels = await tab.playwright.evaluate((target) => {
    const values = [];
    for (const element of Array.from(document.querySelectorAll("button,[role='button']"))) {
      const text = (element.textContent || "").trim().replace(/\s+/g, " ");
      if (text && text.normalize("NFKC").toLowerCase() === target) values.push(text);
    }
    return Array.from(new Set(values));
  }, wanted);
  return labels.length === 1 ? labels[0] : null;
}

async function findProject(tab, requested) {
  const label = await actualProjectLabel(tab, requested);
  if (!label) return null;
  const locator = tab.playwright.getByRole("button", { name: label, exact: true });
  return await locator.count() === 1 ? { label, locator } : null;
}

async function waitForProject(tab, requested) {
  const control = tab.playwright.getByRole("button", { name: requested, exact: true });
  try {
    await control.waitFor({ state: "visible", timeoutMs: 15000 });
  } catch {
    return null;
  }
  return findProject(tab, requested);
}

async function openProject(tab, project) {
  await tab.playwright.domSnapshot();
  // A fresh ChatGPT tab can render its shell before the project list hydrates.
  // Wait for the requested control before deciding that fallback is necessary.
  let target = await waitForProject(tab, project);

  if (!target) {
    const more = tab.playwright.getByText("More", { exact: true });
    const moreCount = await more.count();
    if (moreCount === 1 && await more.isVisible()) {
      await more.click();
      await tab.playwright.domSnapshot();
      target = await findProject(tab, project);
    }
  }

  if (!target) {
    const snapshot = await tab.playwright.domSnapshot();
    if (/\bLog in\b|\bSign up\b/i.test(snapshot)) {
      return { status: "authentication_required", requestedProject: project };
    }
    return { status: "project_not_found", requestedProject: project, fallbackProject: FALLBACK_PROJECT };
  }

  await target.locator.click();
  await tab.playwright.domSnapshot();

  // Expanding a project can replace its sidebar row. Reacquire the project
  // control so the home button is scoped to the current DOM, not a stale row.
  target = await findProject(tab, target.label);
  if (!target) throw new Error(`Project ${project} disappeared after it was opened.`);
  const row = target.locator.locator("xpath=..");
  const home = row.getByRole("button", { name: "Open project home", exact: true });
  await (await requireOne(home, `project-home control for ${project}`)).click();
  const composerName = `New chat in ${target.label}`;

  // Project navigation and composer mounting are asynchronous. Waiting on the
  // actual accessible textbox avoids a false failure from an early snapshot.
  const projectComposer = tab.playwright.getByRole("textbox", { name: composerName, exact: true });
  try {
    await projectComposer.waitFor({ state: "visible", timeoutMs: 15000 });
  } catch {
    throw new Error(`Project home did not expose ${composerName} within 15 seconds.`);
  }
  await requireOne(projectComposer, `project composer ${composerName}`);
  return { status: "project_open", composerName };
}

async function composer(tab, composerName) {
  return requireOne(
    tab.playwright.getByRole("textbox", { name: composerName, exact: true }),
    `project composer ${composerName}`,
  );
}

async function activeConversationComposer(tab) {
  const boxes = tab.playwright.locator("main").getByRole("textbox").filter({ visible: true });
  return requireOne(boxes, "active conversation composer");
}

async function emptyComposer(box) {
  const existingText = (await box.textContent() || "").trim();
  if (existingText) {
    throw new Error("The target ChatGPT composer already contains a draft; refusing to overwrite it.");
  }
}

async function chooseLocalFiles(tab, paths) {
  const add = tab.playwright.getByRole("button", { name: "Add files and more", exact: true });
  await (await requireOne(add, "Add files and more button")).click();
  await tab.playwright.domSnapshot();
  const upload = tab.playwright.getByText("Upload from computer", { exact: true });
  const uniqueUpload = await requireOne(upload, "Upload from computer option");
  const chooserPromise = tab.playwright.waitForEvent("filechooser", { timeoutMs: 10000 });
  await uniqueUpload.click();
  const chooser = await chooserPromise;
  if (!chooser.isMultiple() && paths.length > 1) {
    throw new Error("ChatGPT's file chooser does not allow multiple files in this session.");
  }
  await chooser.setFiles(paths, { timeoutMs: 120000 });
}

async function waitForUploadReady(tab) {
  const sendButton = tab.playwright.getByRole("button", { name: "Send prompt", exact: true });
  await sendButton.waitFor({ state: "visible", timeoutMs: 120000 });
  const deadline = Date.now() + 120000;
  while (!await sendButton.isEnabled()) {
    if (Date.now() >= deadline) throw new Error("ChatGPT did not finish preparing the file upload within 120 seconds.");
    await tab.playwright.waitForTimeout(250);
  }
}

async function attachPreparedFiles(tab, prepared) {
  if (prepared.files.length === 0) return;
  await chooseLocalFiles(tab, prepared.files);
  await tab.playwright.domSnapshot();
  for (const source of prepared.sources) {
    for (const upload of source.uploads) {
      const attachment = tab.playwright.getByRole("group", { name: upload.name, exact: true });
      await attachment.waitFor({ state: "visible", timeoutMs: 120000 });
      await requireOne(attachment, `uploaded attachment ${upload.name}`);
    }
  }
  await waitForUploadReady(tab);
}

async function sendCurrentComposer(tab) {
  const sendButton = tab.playwright.getByRole("button", { name: "Send prompt", exact: true });
  const uniqueSend = await requireOne(sendButton, "Send prompt button");
  if (!await uniqueSend.isEnabled()) throw new Error("Send prompt button is disabled.");
  await uniqueSend.click();
}

async function attachGitHubPlugin(tab, composerName) {
  const box = await composer(tab, composerName);
  const existingText = (await box.textContent() || "").trim();
  if (existingText) {
    await box.fill("");
    if ((await box.textContent() || "").trim()) throw new Error("Could not clear the project composer.");
  }

  const add = tab.playwright.getByRole("button", { name: "Add files and more", exact: true });
  await (await requireOne(add, "Add files and more button")).click();
  await tab.playwright.domSnapshot();
  const github = tab.playwright.getByText("GitHub", { exact: true });
  if (await github.count() === 0) {
    await box.type("github");
    await tab.playwright.domSnapshot();
  }
  await (await requireOne(github, "GitHub attachment option")).click();
  await tab.playwright.domSnapshot();

  const pill = (await composer(tab, composerName)).getByText("GitHub", { exact: true });
  await pill.waitFor({ state: "visible", timeoutMs: 5000 });
  if (!await pill.isVisible()) throw new Error("GitHub plugin pill was not visibly attached.");
}

async function enableImageMode(tab, composerName, aspectRatio) {
  const add = tab.playwright.getByRole("button", { name: "Add files and more", exact: true });
  await (await requireOne(add, "Add files and more button")).click();
  await tab.playwright.domSnapshot();
  const create = tab.playwright.getByText("Create image", { exact: true });
  await (await requireOne(create, "Create image option")).click();
  await tab.playwright.domSnapshot();

  const pill = (await composer(tab, composerName)).getByText("Image, click to remove", { exact: true });
  await pill.waitFor({ state: "visible", timeoutMs: 5000 });
  if (!await pill.isVisible()) throw new Error("Image mode pill was not visibly attached.");

  if (aspectRatio) {
    const ratioButton = tab.playwright.getByRole("button", { name: "Choose image aspect ratio", exact: true });
    await (await requireOne(ratioButton, "image aspect-ratio control")).click();
    await tab.playwright.domSnapshot();
    const ratio = tab.playwright.getByText(aspectRatio, { exact: true });
    await (await requireOne(ratio, `image aspect ratio ${aspectRatio}`)).click();
  }
}

const THINKING_LEVELS = new Map([
  ["instant", "Instant 5.5"],
  ["medium", "Medium"],
  ["high", "High"],
  ["extra high", "Extra High"],
  ["extra-high", "Extra High"],
  ["pro", "Pro"],
]);

function normalizeThinkingLevel(value) {
  const normalizedValue = String(value).normalize("NFKC").trim().toLowerCase();
  const label = THINKING_LEVELS.get(normalizedValue);
  if (!label) {
    throw new Error(`Unsupported thinkingLevel ${JSON.stringify(value)}. Expected instant, medium, high, extra-high, or pro.`);
  }
  return { value: normalizedValue, label };
}

async function ensureThinkingLevel(tab, thinkingLevel = "pro") {
  const requested = normalizeThinkingLevel(thinkingLevel);
  const main = tab.playwright.locator("main");
  const activeLabels = ["Instant 5.5", "Medium", "High", "Extra High", "Pro"];
  let activeMode = null;
  for (const label of activeLabels) {
    const candidate = main.getByRole("button", { name: label, exact: true });
    if (await visible(candidate)) {
      activeMode = candidate;
      break;
    }
  }
  if (!activeMode) throw new Error("The active thinking-level button could not be identified.");

  if (requested.label !== (await activeMode.textContent() || "").trim()) {
    await activeMode.click();
    await tab.playwright.domSnapshot();
    const option = tab.playwright.getByRole("menuitemradio", { name: requested.label, exact: true });
    await (await requireOne(option, `${requested.label} thinking-level option`)).click();
    await tab.playwright.domSnapshot();
  }

  const selected = main.getByRole("button", { name: requested.label, exact: true });
  if (!await visible(selected)) throw new Error(`${requested.label} was not visibly selected.`);

  if (requested.value !== "pro") return { thinkingLevel: requested.value, mode: requested.label };

  await selected.click();
  await tab.playwright.domSnapshot();
  const modelMenu = tab.playwright.getByRole("menuitem", { name: "GPT-5.6 Sol", exact: true });
  await (await requireOne(modelMenu, "GPT-5.6 Sol model menu")).click();
  await tab.playwright.domSnapshot();
  const solRadio = tab.playwright.getByRole("menuitemradio", { name: "GPT-5.6 Sol", exact: true });
  await (await requireOne(solRadio, "GPT-5.6 Sol model option")).click();
  await tab.playwright.domSnapshot();
  if (!await visible(selected)) throw new Error("Pro was not visibly selected after choosing GPT-5.6 Sol.");
  return { thinkingLevel: requested.value, mode: "Pro", model: "GPT-5.6 Sol" };
}

export async function startConsult({ iab, project, prompt, paths = [], send = true, createImage = false, aspectRatio = null, thinkingLevel = "pro", attachGitHub = true, maxUploadBytes }) {
  if (!iab || !project || !prompt) throw new Error("iab, project, and prompt are required.");
  const prepared = prepareUploadPaths(paths, { maxUploadBytes });
  let tab;
  try {
    tab = await iab.tabs.new();
    await tab.goto(CHATGPT_URL);

    const requestedProject = project;
    let selectedProject = project;
    let usedFallbackProject = false;
    let opened = await openProject(tab, selectedProject);
    if (opened.status === "project_not_found" && normalized(selectedProject) !== normalized(FALLBACK_PROJECT)) {
      selectedProject = FALLBACK_PROJECT;
      usedFallbackProject = true;
      opened = await openProject(tab, selectedProject);
    }
    if (opened.status !== "project_open") return { ...opened, tab };

    await emptyComposer(await composer(tab, opened.composerName));
    if (attachGitHub) await attachGitHubPlugin(tab, opened.composerName);
    if (createImage) await enableImageMode(tab, opened.composerName, aspectRatio);
    const modelSelection = await ensureThinkingLevel(tab, thinkingLevel);
    const box = await composer(tab, opened.composerName);
    await attachPreparedFiles(tab, prepared);

    if (!send) return {
      status: "setup_verified_not_sent",
      project: selectedProject,
      requestedProject,
      usedFallbackProject,
      githubAttached: attachGitHub,
      attachments: prepared.sources,
      ...modelSelection,
      tab,
    };

    await box.type(prompt);

    if (attachGitHub) {
      const githubPill = box.getByText("GitHub", { exact: true });
      if (!await visible(githubPill)) throw new Error("GitHub pill was not visible immediately before send.");
    }
    await sendCurrentComposer(tab);

    return {
      status: "sent",
      project: selectedProject,
      requestedProject,
      usedFallbackProject,
      githubAttached: attachGitHub,
      attachments: prepared.sources,
      ...modelSelection,
      tab,
      url: await tab.url(),
    };
  } finally {
    prepared.cleanup();
  }
}

export async function sendToExistingConsult({ session, tab = session?.tab, paths = [], prompt = "", send = true, maxUploadBytes }) {
  if (!tab) throw new Error("An existing consult session or tab is required.");
  if (!prompt && (typeof paths === "string" ? !paths : paths.length === 0)) {
    throw new Error("Provide at least one attachment path or a prompt for the existing session.");
  }
  const prepared = prepareUploadPaths(paths, { maxUploadBytes });
  try {
    const box = await activeConversationComposer(tab);
    await emptyComposer(box);
    await attachPreparedFiles(tab, prepared);
    if (prompt) await box.type(prompt);

    if (!send) return {
      status: "existing_session_prepared_not_sent",
      attachments: prepared.sources,
      tab,
      url: await tab.url(),
    };

    await sendCurrentComposer(tab);
    return {
      status: "sent_to_existing_session",
      attachments: prepared.sources,
      tab,
      url: await tab.url(),
    };
  } finally {
    prepared.cleanup();
  }
}

export function publicResult(session) {
  const { tab, ...result } = session;
  return result;
}
