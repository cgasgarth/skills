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

async function openProject(tab, project) {
  await tab.playwright.domSnapshot();
  let target = await findProject(tab, project);

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
  const row = target.locator.locator("xpath=..");
  const home = row.getByRole("button", { name: "Open project home", exact: true });
  await (await requireOne(home, `project-home control for ${project}`)).click();
  const snapshot = await tab.playwright.domSnapshot();
  const composerName = `New chat in ${target.label}`;
  if (!snapshot.includes(composerName)) {
    throw new Error(`Project home did not expose ${composerName}.`);
  }
  return { status: "project_open", composerName };
}

async function composer(tab, composerName) {
  return requireOne(
    tab.playwright.getByRole("textbox", { name: composerName, exact: true }),
    `project composer ${composerName}`,
  );
}

async function attachGitHub(tab, composerName) {
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
  if (!await pill.isVisible()) throw new Error("GitHub source pill was not visibly attached.");
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

async function ensurePro(tab) {
  const main = tab.playwright.locator("main");
  const pro = main.getByRole("button", { name: "Pro", exact: true });

  if (!await visible(pro)) {
    const activeLabels = ["Latest", "Instant", "Thinking", "Medium", "High", "Extra High"];
    let activeMode = null;
    for (const label of activeLabels) {
      const candidate = main.getByRole("button", { name: label, exact: true });
      if (await visible(candidate)) {
        activeMode = candidate;
        break;
      }
    }
    if (!activeMode) throw new Error("Pro is absent and the active model-mode button could not be identified.");
    await activeMode.click();
    await tab.playwright.domSnapshot();
    const proOption = tab.playwright.getByRole("menuitemradio", { name: "Pro", exact: true });
    await (await requireOne(proOption, "Pro mode option")).click();
    await tab.playwright.domSnapshot();
    if (!await visible(pro)) throw new Error("Pro was not visibly selected.");
  }

  await pro.click();
  await tab.playwright.domSnapshot();
  const modelMenu = tab.playwright.getByRole("menuitem", { name: "GPT-5.6 Sol", exact: true });
  await (await requireOne(modelMenu, "GPT-5.6 Sol model menu")).click();
  await tab.playwright.domSnapshot();
  const solRadio = tab.playwright.getByRole("menuitemradio", { name: "GPT-5.6 Sol", exact: true });
  const uniqueSolRadio = await requireOne(solRadio, "GPT-5.6 Sol model option");
  await uniqueSolRadio.click();
  await tab.playwright.domSnapshot();
  if (!await visible(pro)) throw new Error("Pro was not visibly selected after choosing GPT-5.6 Sol.");
  return { mode: "Pro", model: "GPT-5.6 Sol" };
}

export async function startConsult({ iab, project, prompt, send = true, createImage = false, aspectRatio = null }) {
  if (!iab || !project || !prompt) throw new Error("iab, project, and prompt are required.");
  const tab = await iab.tabs.new();
  await tab.goto(CHATGPT_URL);

  const opened = await openProject(tab, project);
  if (opened.status !== "project_open") return { ...opened, tab };

  await attachGitHub(tab, opened.composerName);
  if (createImage) await enableImageMode(tab, opened.composerName, aspectRatio);
  const modelSelection = await ensurePro(tab);

  if (!send) return { status: "setup_verified_not_sent", project, githubAttached: true, ...modelSelection, tab };

  const box = await composer(tab, opened.composerName);
  await box.type(prompt);

  const githubPill = box.getByText("GitHub", { exact: true });
  if (!await visible(githubPill)) throw new Error("GitHub pill was not visible immediately before send.");
  const sendButton = tab.playwright.getByRole("button", { name: "Send prompt", exact: true });
  const uniqueSend = await requireOne(sendButton, "Send prompt button");
  if (!await uniqueSend.isEnabled()) throw new Error("Send prompt button is disabled.");
  await uniqueSend.click();

  return {
    status: "sent",
    project,
    githubAttached: true,
    ...modelSelection,
    tab,
    url: await tab.url(),
  };
}

export function publicResult(session) {
  const { tab, ...result } = session;
  return result;
}
