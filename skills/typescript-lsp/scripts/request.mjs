#!/usr/bin/env bun

import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

const TOKEN_TYPES = [
  "namespace", "type", "class", "enum", "interface", "struct", "typeParameter",
  "parameter", "variable", "property", "enumMember", "event", "function", "method",
  "macro", "keyword", "modifier", "comment", "string", "number", "regexp", "operator",
  "decorator", "label",
];

const TOKEN_MODIFIERS = [
  "declaration", "definition", "readonly", "static", "deprecated", "abstract", "async",
  "modification", "documentation", "defaultLibrary",
];

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

function replacePlaceholders(value, fileUri, rootUri) {
  if (value === "$FILE_URI") return fileUri;
  if (value === "$ROOT_URI") return rootUri;
  if (Array.isArray(value)) return value.map((item) => replacePlaceholders(item, fileUri, rootUri));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replacePlaceholders(item, fileUri, rootUri)]),
    );
  }
  return value;
}

class Client {
  constructor(command, root) {
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
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const length = Number(header.match(/Content-Length:\s*(\d+)/i)?.[1]);
      if (!Number.isInteger(length)) return this.rejectAll(new Error("Invalid LSP header"));
      const bodyEnd = headerEnd + 4 + length;
      if (this.buffer.length < bodyEnd) return;
      const message = JSON.parse(this.buffer.subarray(headerEnd + 4, bodyEnd).toString("utf8"));
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

function clientCapabilities() {
  const links = { linkSupport: true };
  return {
    general: { positionEncodings: ["utf-16"] },
    workspace: {
      workspaceFolders: true,
      workspaceEdit: {
        documentChanges: true,
        resourceOperations: ["create", "rename", "delete"],
      },
      fileOperations: { willRename: true },
    },
    textDocument: {
      completion: {
        contextSupport: true,
        completionItem: {
          snippetSupport: true,
          documentationFormat: ["markdown", "plaintext"],
          labelDetailsSupport: true,
          resolveSupport: {
            properties: ["documentation", "detail", "additionalTextEdits", "command"],
          },
        },
      },
      hover: { contentFormat: ["markdown", "plaintext"] },
      signatureHelp: {
        signatureInformation: {
          documentationFormat: ["markdown", "plaintext"],
          parameterInformation: { labelOffsetSupport: true },
        },
      },
      definition: links,
      typeDefinition: links,
      implementation: links,
      references: {},
      documentHighlight: {},
      documentSymbol: { hierarchicalDocumentSymbolSupport: true },
      codeAction: {
        codeActionLiteralSupport: {
          codeActionKind: {
            valueSet: [
              "quickfix", "refactor", "refactor.extract", "refactor.inline", "refactor.rewrite",
              "source", "source.organizeImports", "source.fixAll",
            ],
          },
        },
      },
      codeLens: {},
      formatting: {},
      rangeFormatting: {},
      onTypeFormatting: {},
      rename: { prepareSupport: true },
      foldingRange: { lineFoldingOnly: true },
      selectionRange: {},
      callHierarchy: {},
      linkedEditingRange: {},
      semanticTokens: {
        requests: { range: true, full: true },
        tokenTypes: TOKEN_TYPES,
        tokenModifiers: TOKEN_MODIFIERS,
        formats: ["relative"],
      },
      inlayHint: {},
      diagnostic: { relatedDocumentSupport: true },
      publishDiagnostics: { relatedInformation: true, versionSupport: true },
    },
  };
}

async function main() {
  const [fileArg, method, paramsArg = "{}"] = process.argv.slice(2);
  if (!fileArg || !method) {
    stop("Usage: request.mjs FILE METHOD PARAMS_JSON\nUse - for PARAMS_JSON to read stdin.");
  }
  if (["initialize", "initialized", "shutdown", "exit"].includes(method)) {
    stop(`${method} is managed by the client`);
  }

  const file = path.resolve(fileArg);
  const languageId = LANGUAGES[path.extname(file).toLowerCase()];
  if (!languageId) stop(`Unsupported file extension: ${path.extname(file)}`);
  const text = await readFile(file, "utf8");
  const root = rootFor(file);
  const fileUri = pathToFileURL(file).href;
  const rootUri = pathToFileURL(root).href;

  const paramsText = paramsArg === "-" ? await readFile(0, "utf8") : paramsArg;
  let params = replacePlaceholders(JSON.parse(paramsText), fileUri, rootUri);
  if (method.includes("textDocument/") && !params.textDocument) {
    params = { ...params, textDocument: { uri: fileUri } };
  }

  const localTsc = path.join(root, "node_modules", ".bin", "tsc");
  const tscCandidates = process.env.TS_LSP_TSC
    ? [process.env.TS_LSP_TSC]
    : [localTsc, "tsc"];
  const tsc = tscCandidates.find((candidate) => {
    const version = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    const major = Number(version.stdout.match(/Version\s+(\d+)/)?.[1]);
    return version.status === 0 && major >= 7;
  });
  if (!tsc) {
    stop(`TypeScript 7 or later was not found in ${localTsc} or PATH`);
  }

  const client = new Client(tsc, root);
  try {
    await client.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "codex-typescript-lsp-skill", version: "1" },
      rootUri,
      workspaceFolders: [client.folder],
      capabilities: clientCapabilities(),
    });
    client.notify("initialized", {});
    client.notify("textDocument/didOpen", {
      textDocument: { uri: fileUri, languageId, version: 1, text },
    });
    const result = await client.request(method, params);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  process.stderr.write(`typescript-lsp: ${error.message}\n`);
  process.exitCode = 1;
});
