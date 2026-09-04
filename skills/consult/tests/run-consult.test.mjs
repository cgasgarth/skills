import { describe, expect, it } from "bun:test";
import {
  attachGitHubPlugin,
  ensureChatMode,
  enableImageMode,
  ensureThinkingLevel,
  sendToExistingConsult,
  startConsult,
} from "../scripts/run-consult.mjs";

function modeTab({ checked = false, authenticationRequired = false, missing = false } = {}) {
  let chatChecked = checked;
  let clicks = 0;
  let snapshots = 0;

  const chat = {
    async click() {
      clicks += 1;
      chatChecked = true;
    },
    async count() {
      return 1;
    },
    async getAttribute(name) {
      return name === "aria-checked" && chatChecked ? "true" : "false";
    },
    async isVisible() {
      return true;
    },
  };
  const surface = {
    async count() {
      return missing ? 0 : 1;
    },
    getByRole(role, options) {
      expect(role).toBe("radio");
      expect(options).toEqual({ name: "Chat", exact: true });
      return chat;
    },
    async waitFor() {
      if (missing) throw new Error("missing");
    },
  };
  const tab = {
    playwright: {
      async domSnapshot() {
        snapshots += 1;
        return authenticationRequired ? "Log in" : "ChatGPT";
      },
      getByRole(role, options) {
        expect(role).toBe("radiogroup");
        expect(options).toEqual({ name: "Select chat surface", exact: true });
        return surface;
      },
    },
  };
  return {
    tab,
    state: () => ({ chatChecked, clicks, snapshots }),
  };
}

describe("ensureChatMode", () => {
  it("leaves an already-selected Chat surface unchanged", async () => {
    const fixture = modeTab({ checked: true });

    expect(await ensureChatMode(fixture.tab)).toEqual({
      status: "chat_selected",
      chatSurface: "chat",
    });
    expect(fixture.state()).toEqual({ chatChecked: true, clicks: 0, snapshots: 1 });
  });

  it("switches from Work to Chat and verifies the result", async () => {
    const fixture = modeTab();

    expect(await ensureChatMode(fixture.tab)).toEqual({
      status: "chat_selected",
      chatSurface: "chat",
    });
    expect(fixture.state()).toEqual({ chatChecked: true, clicks: 1, snapshots: 2 });
  });

  it("preserves the authentication handoff when the selector is unavailable", async () => {
    const fixture = modeTab({ authenticationRequired: true, missing: true });

    expect(await ensureChatMode(fixture.tab)).toEqual({ status: "authentication_required" });
    expect(fixture.state().clicks).toBe(0);
  });

  it("fails closed when the selector is missing from an authenticated page", async () => {
    const fixture = modeTab({ missing: true });

    expect(ensureChatMode(fixture.tab)).rejects.toThrow("did not expose");
  });
});

describe("attachGitHubPlugin", () => {
  it("reacquires the GitHub option after the fallback search changes the page", async () => {
    let attached = false;
    let searches = 0;
    let optionQueries = 0;
    const box = {
      async count() {
        return 1;
      },
      async textContent() {
        return "";
      },
      async type(value) {
        expect(value).toBe("github");
        searches += 1;
      },
      getByText(text, options) {
        expect(text).toBe("GitHub");
        expect(options).toEqual({ exact: true });
        return {
          async waitFor() {},
          async isVisible() {
            return attached;
          },
        };
      },
    };
    const add = {
      async count() {
        return 1;
      },
      async click() {},
    };
    const tab = {
      playwright: {
        async domSnapshot() {},
        getByRole(role, options) {
          if (role === "textbox") {
            expect(options).toEqual({ name: "New chat in Consult", exact: true });
            return box;
          }
          expect(role).toBe("button");
          expect(options).toEqual({ name: "Add files and more", exact: true });
          return add;
        },
        getByText(text, options) {
          expect(text).toBe("GitHub");
          expect(options).toEqual({ exact: true });
          optionQueries += 1;
          const available = optionQueries > 1;
          return {
            async count() {
              return available ? 1 : 0;
            },
            locator(selector) {
              expect(selector).toBe("xpath=ancestor::div[@tabindex='0'][1]");
              return {
                async count() {
                  return available ? 1 : 0;
                },
                async click() {
                  expect(available).toBe(true);
                  attached = true;
                },
              };
            },
          };
        },
      },
    };

    await attachGitHubPlugin(tab, "New chat in Consult");

    expect({ attached, optionQueries, searches }).toEqual({
      attached: true,
      optionQueries: 2,
      searches: 1,
    });
  });
});

describe("enableImageMode", () => {
  it("verifies the current image pill after the composer is replaced", async () => {
    let imageModeEnabled = false;
    let snapshots = 0;
    const add = {
      async count() {
        return 1;
      },
      async click() {},
    };
    const create = {
      async count() {
        return 1;
      },
      async click() {
        imageModeEnabled = true;
      },
    };
    const pill = {
      async count() {
        return imageModeEnabled ? 1 : 0;
      },
      async isVisible() {
        return imageModeEnabled;
      },
      async waitFor() {
        if (!imageModeEnabled) throw new Error("image mode not enabled");
      },
    };
    const missingRatioButton = {
      async count() {
        return 0;
      },
      async isVisible() {
        return false;
      },
    };
    const tab = {
      playwright: {
        async domSnapshot() {
          snapshots += 1;
        },
        getByRole(role, options) {
          expect(role).toBe("button");
          if (options.name === "Add files and more") return add;
          expect(options).toEqual({ name: "Choose image aspect ratio", exact: true });
          return missingRatioButton;
        },
        getByText(text, options) {
          expect(text).toBe("Create image");
          expect(options).toEqual({ exact: true });
          return create;
        },
        locator(selector) {
          expect(selector).toBe(
            '[data-inline-selection-pill][data-id="picture_v2"][data-keyword="Create image"]',
          );
          return pill;
        },
      },
    };

    expect(await enableImageMode(tab, "16:9")).toEqual({
      promptPrefix: "Create the image at a 16:9 aspect ratio.\n\n",
    });
    expect({ imageModeEnabled, snapshots }).toEqual({
      imageModeEnabled: true,
      snapshots: 2,
    });
  });
});

describe("startConsult", () => {
  it("rejects incompatible GitHub and image modes before opening a tab", async () => {
    let openedTabs = 0;
    const iab = {
      tabs: {
        async new() {
          openedTabs += 1;
          return {};
        },
      },
    };

    expect(
      startConsult({
        iab,
        project: "Consult",
        prompt: "Create a visual.",
        createImage: true,
        attachGitHub: true,
      }),
    ).rejects.toThrow("cannot remain active with the GitHub plugin attached");
    expect(openedTabs).toBe(0);
  });
});

describe("ensureThinkingLevel", () => {
  it("changes an alternate Pro model to 6 Pro and verifies Latest", async () => {
    let activeLabel = "5.6 Pro";
    let menuOpen = false;
    let modelMenuOpen = false;
    let power = 4;
    let powerChanges = 0;
    let latestSelected = false;
    const button = (label) => ({
      async click() {
        menuOpen = !menuOpen;
      },
      async count() {
        if (label === "Thinking effort") return menuOpen ? 1 : 0;
        return (label instanceof RegExp ? label.test(activeLabel) : activeLabel === label) ? 1 : 0;
      },
      async isVisible() {
        if (label === "Thinking effort") return menuOpen;
        return label instanceof RegExp ? label.test(activeLabel) : activeLabel === label;
      },
      async waitFor() {
        if (!(label instanceof RegExp ? label.test(activeLabel) : activeLabel === label)) {
          throw new Error(`${String(label)} not visible`);
        }
      },
    });
    const main = {
      getByRole(role, options) {
        expect(role).toBe("button");
        return button(options.name);
      },
    };
    const slider = {
      async count() {
        return menuOpen ? 1 : 0;
      },
      async press(key) {
        expect(menuOpen).toBe(true);
        powerChanges += 1;
        if (key === "Home") power = 0;
        if (key === "ArrowRight") power += 1;
        activeLabel = ["Instant 5.5", "Medium", "High", "Extra High", "6 Pro"][power];
      },
    };
    const effortMenu = {
      async count() {
        return menuOpen ? 1 : 0;
      },
      async isVisible() {
        return menuOpen;
      },
      getByRole(role, options) {
        expect(role).toBe("menuitem");
        expect(options).toEqual({ name: "Select model", exact: true });
        return {
          async click() {
            modelMenuOpen = true;
          },
          async count() {
            return menuOpen ? 1 : 0;
          },
        };
      },
    };
    const latestRadio = {
      async count() {
        return menuOpen && modelMenuOpen ? 1 : 0;
      },
      async getAttribute(name) {
        return name === "aria-checked" && latestSelected ? "true" : "false";
      },
      async isVisible() {
        return menuOpen && modelMenuOpen;
      },
      async press(key) {
        expect(key).toBe("Space");
        latestSelected = true;
        activeLabel = "6 Pro";
        modelMenuOpen = false;
      },
    };
    const tab = {
      playwright: {
        async domSnapshot() {},
        locator(selector) {
          if (selector === "main") return main;
          expect(selector).toBe('[role="slider"]');
          return slider;
        },
        getByRole(role, options) {
          if (role === "menu") {
            expect(options).toEqual({ name: "Thinking effort", exact: true });
            return effortMenu;
          }
          expect(role).toBe("menuitemradio");
          expect(options).toEqual({ name: "Latest", exact: true });
          return latestRadio;
        },
      },
    };

    expect(await ensureThinkingLevel(tab, "pro")).toEqual({
      thinkingLevel: "pro",
      mode: "Pro",
      model: "GPT-6",
    });
    expect({ activeLabel, latestSelected, menuOpen, modelMenuOpen, power, powerChanges }).toEqual({
      activeLabel: "6 Pro",
      latestSelected: true,
      menuOpen: false,
      modelMenuOpen: false,
      power: 4,
      powerChanges: 0,
    });
  });
});

describe("sendToExistingConsult", () => {
  it("does not inspect or change the Chat/Work surface for a follow-up", async () => {
    let typedPrompt = "";
    const box = {
      async count() {
        return 1;
      },
      filter() {
        return this;
      },
      async innerText() {
        return "";
      },
      async type(value) {
        typedPrompt = value;
      },
    };
    const tab = {
      playwright: {
        locator(selector) {
          expect(selector).toBe("main");
          return {
            getByRole(role) {
              expect(role).toBe("textbox");
              return box;
            },
          };
        },
      },
      async url() {
        return "https://chatgpt.com/c/existing";
      },
    };

    const result = await sendToExistingConsult({
      tab,
      prompt: "Follow up without changing modes.",
      send: false,
    });

    expect(typedPrompt).toBe("Follow up without changing modes.");
    expect(result).toEqual({
      status: "existing_session_prepared_not_sent",
      attachments: [],
      tab,
      url: "https://chatgpt.com/c/existing",
    });
  });

  it("clears an existing draft without confirmation before preparing the follow-up", async () => {
    let composerText = "Old draft that must be replaced.";
    const box = {
      async count() {
        return 1;
      },
      filter() {
        return this;
      },
      async innerText() {
        return composerText;
      },
      async fill(value) {
        composerText = value;
      },
      async type(value) {
        composerText += value;
      },
    };
    const tab = {
      playwright: {
        locator(selector) {
          expect(selector).toBe("main");
          return {
            getByRole(role) {
              expect(role).toBe("textbox");
              return box;
            },
          };
        },
      },
      async url() {
        return "https://chatgpt.com/c/existing";
      },
    };

    const result = await sendToExistingConsult({
      tab,
      prompt: "Replacement prompt.",
      send: false,
    });

    expect(composerText).toBe("Replacement prompt.");
    expect(result.status).toBe("existing_session_prepared_not_sent");
  });
});
