#!/usr/bin/env bun

import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const METHODS = {
  hover: "textDocument/hover",
  definition: "textDocument/definition",
  "type-definition": "textDocument/typeDefinition",
  implementation: "textDocument/implementation",
  references: "textDocument/references",
};

const LANGUAGES = {
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".mts": "typescript",
  ".cts": "typescript",
  ".mjs": "javascript",
  ".cjs": "javascript",
};

function usage() {
  return "Usage: query.mjs <hover|definition|type-definition|implementation|references> FILE SEARCH [OCCURRENCE]\n";
}

function stop(message) {
  throw new Error(message);
}

function rootFor(file) {
  const result = spawnSync("git", ["-C", path.dirname(file), "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : path.dirname(file);
}

function positionOf(text, search, occurrence) {
  let offset = -1;
  let from = 0;
  for (let index = 0; index < occurrence; index += 1) {
    offset = text.indexOf(search, from);
    if (offset < 0) stop(`Could not find occurrence ${occurrence} of ${JSON.stringify(search)}`);
    from = offset + search.length;
  }
  const lines = text.slice(0, offset).split(/\r?\n/);
  return { line: lines.length - 1, character: lines.at(-1).length };
}

function normalize(value) {
  if (typeof value === "string" && value.startsWith("file:")) {
    try {
      return fileURLToPath(value);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
}

class Client {
  constructor(command, root) {
    this.root = root;
    this.folder = { uri: pathToFileURL(root).href, name: path.basename(root) };
    this.child = spawn(command, ["--lsp", "--stdio"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.buffer = Buffer.alloc(0);
    this.pending = new Map();
    this.id = 0;
    this.stderr = "";
    this.child.stdout.on("data", (chunk) => this.read(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-4000);
    });
    this.child.on("error", (error) => this.rejectAll(error));
    this.child.on("exit", (code) => {
      if (this.pending.size) this.rejectAll(new Error(`LSP exited with code ${code}: ${this.stderr}`));
    });
  }

  read(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const end = this.buffer.indexOf("\r\n\r\n");
      if (end < 0) return;
      const header = this.buffer.subarray(0, end).toString("ascii");
      const length = Number(header.match(/Content-Length:\s*(\d+)/i)?.[1]);
      if (!Number.isInteger(length)) return this.rejectAll(new Error("Invalid LSP header"));
      const bodyEnd = end + 4 + length;
      if (this.buffer.length < bodyEnd) return;
      const message = JSON.parse(this.buffer.subarray(end + 4, bodyEnd).toString("utf8"));
      this.buffer = this.buffer.subarray(bodyEnd);
      this.message(message);
    }
  }

  message(message) {
    if (message.id !== undefined && ("result" in message || "error" in message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      return message.error
        ? pending.reject(new Error(message.error.message))
        : pending.resolve(message.result);
    }
    if (message.id === undefined || !message.method) return;

    const results = {
      "workspace/configuration": (message.params?.items ?? []).map(() => null),
      "workspace/workspaceFolders": [this.folder],
      "client/registerCapability": null,
      "client/unregisterCapability": null,
      "window/workDoneProgress/create": null,
    };
    if (message.method in results) {
      this.send({ jsonrpc: "2.0", id: message.id, result: results[message.method] });
    } else {
      this.send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } });
    }
  }

  send(message) {
    const body = JSON.stringify(message);
    this.child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  request(method, params, timeout = 30000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method, params) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  async close() {
    if (this.child.exitCode !== null) return;
    try {
      await this.request("shutdown", null, 3000);
      this.notify("exit");
    } catch {
      this.child.kill("SIGTERM");
    }
  }
}

async function main() {
  const [operation, fileArg, search, occurrenceArg = "1"] = process.argv.slice(2);
  if (!(operation in METHODS) || !fileArg || search === undefined) stop(usage());
  const occurrence = Number(occurrenceArg);
  if (!Number.isInteger(occurrence) || occurrence < 1) stop("OCCURRENCE must be a positive integer");

  const file = path.resolve(fileArg);
  const languageId = LANGUAGES[path.extname(file).toLowerCase()];
  if (!languageId) stop(`Unsupported file extension: ${path.extname(file)}`);
  const text = await readFile(file, "utf8");
  const position = positionOf(text, search, occurrence);
  const root = rootFor(file);

  const tsc = process.env.TS_LSP_TSC || "tsc";
  const version = spawnSync(tsc, ["--version"], { encoding: "utf8" });
  const major = Number(version.stdout.match(/Version\s+(\d+)/)?.[1]);
  if (version.status !== 0 || major < 7) stop(`${tsc} must be TypeScript 7 or later`);

  const client = new Client(tsc, root);
  const uri = pathToFileURL(file).href;
  try {
    await client.request("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(root).href,
      workspaceFolders: [client.folder],
      capabilities: {
        general: { positionEncodings: ["utf-16"] },
        textDocument: {
          definition: { linkSupport: true },
          typeDefinition: { linkSupport: true },
          implementation: { linkSupport: true },
          hover: { contentFormat: ["markdown", "plaintext"] },
        },
      },
    });
    client.notify("initialized", {});
    client.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });

    const params = { textDocument: { uri }, position };
    if (operation === "references") params.context = { includeDeclaration: true };
    const result = await client.request(METHODS[operation], params);
    process.stdout.write(`${JSON.stringify(normalize(result), null, 2)}\n`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  process.stderr.write(`typescript-lsp: ${error.message}\n`);
  process.exitCode = 1;
});
