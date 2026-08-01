import { describe, expect, it } from "bun:test";
import { ensureChatMode } from "../scripts/run-consult.mjs";

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
