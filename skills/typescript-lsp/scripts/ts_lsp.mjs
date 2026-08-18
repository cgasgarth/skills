#!/usr/bin/env bun

import { spawn, spawnSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const POSITION_OPERATIONS = new Map([
  ["definition", "textDocument/definition"],
  ["type-definition", "textDocument/typeDefinition"],
  ["implementation", "textDocument/implementation"],
  ["references", "textDocument/references"],
  ["hover", "textDocument/hover"],
]);

const FILE_OPERATIONS = new Map([
  ["document-symbols", "textDocument/documentSymbol"],
]);

const LANGUAGE_IDS = new Map([
  [".ts", "typescript"],
  [".tsx", "typescriptreact"],
  [".js", "javascript"],
  [".jsx", "javascriptreact"],
  [".mts", "typescript"],
  [".cts", "typescript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
]);

function usage() {
  return `Usage:
  ts_lsp.mjs <operation> [options]

Operations:
  definition | type-definition | implementation | references | hover
  document-symbols | workspace-symbols | diagnostics | capabilities

Options:
  --file PATH          Source file or workspace-symbol project anchor
  --search TEXT        Exact text used to select a symbol position
  --occurrence N       One-based search occurrence (default: 1)
  --line N             One-based line
  --column N           One-based UTF-16 column
  --query TEXT         Workspace-symbol query
  --root PATH          Workspace root (default: Git root or nearest project)
  --tsc PATH           TypeScript 7 tsc binary
  --timeout MS         Request timeout (default: 30000)
  --help               Show this help
`;
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const operation = argv[0];
  if (!operation || operation === "--help" || operation === "-h") {
    process.stdout.write(usage());
    process.exit(0);
  }

  const values = {};
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) fail(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    if (key === "help") {
      process.stdout.write(usage());
      process.exit(0);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for --${key}`);
    values[key] = value;
    index += 1;
  }

  return { operation, values };
}

async function exists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function directoryOf(candidate) {
  const resolved = path.resolve(candidate);
  try {
    return (await stat(resolved)).isDirectory() ? resolved : path.dirname(resolved);
  } catch {
    return path.dirname(resolved);
  }
}

async function findUp(start, relativePath) {
  let current = await directoryOf(start);
  while (true) {
    const candidate = path.join(current, relativePath);
    if (await exists(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function resolveRoot(explicitRoot, file) {
  if (explicitRoot) return path.resolve(explicitRoot);
  const start = file ? path.dirname(file) : process.cwd();
  const git = spawnSync("git", ["-C", start, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (git.status === 0 && git.stdout.trim()) return path.resolve(git.stdout.trim());

  const tsconfig = await findUp(start, "tsconfig.json");
  if (tsconfig) return path.dirname(tsconfig);
  const packageJson = await findUp(start, "package.json");
  if (packageJson) return path.dirname(packageJson);
  return path.resolve(start);
}

async function resolveTsc(explicitTsc, root, file) {
  const candidates = [];
  if (explicitTsc) candidates.push(path.resolve(explicitTsc));
  if (file) {
    const fromFile = await findUp(path.dirname(file), "node_modules/.bin/tsc");
    if (fromFile) candidates.push(fromFile);
  }
  const fromRoot = await findUp(root, "node_modules/.bin/tsc");
  if (fromRoot) candidates.push(fromRoot);
  candidates.push("tsc");

  for (const candidate of [...new Set(candidates)]) {
    const version = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (version.status !== 0) continue;
    const output = `${version.stdout}${version.stderr}`.trim();
    const major = Number.parseInt(output.match(/Version\s+(\d+)/)?.[1] ?? "", 10);
    if (Number.isInteger(major) && major >= 7) return { command: candidate, version: output };
  }

  fail("No TypeScript 7 or later tsc binary was found. Install project dependencies or pass --tsc PATH.");
}

function resolvePosition(text, values) {
  if (values.search !== undefined) {
    const occurrence = Number.parseInt(values.occurrence ?? "1", 10);
    if (!Number.isInteger(occurrence) || occurrence < 1) fail("--occurrence must be a positive integer");
    let offset = -1;
    let from = 0;
    for (let index = 0; index < occurrence; index += 1) {
      offset = text.indexOf(values.search, from);
      if (offset < 0) fail(`Could not find occurrence ${occurrence} of --search text`);
      from = offset + values.search.length;
    }
    const before = text.slice(0, offset);
    const lines = before.split(/\r?\n/);
    return { line: lines.length - 1, character: lines.at(-1).length };
  }

  const line = Number.parseInt(values.line ?? "", 10);
  const column = Number.parseInt(values.column ?? "", 10);
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) {
    fail("Provide --search TEXT or one-based --line N and --column N");
  }
  return { line: line - 1, character: column - 1 };
}

function languageId(file) {
  const language = LANGUAGE_IDS.get(path.extname(file).toLowerCase());
  if (!language) fail(`Unsupported source extension: ${path.extname(file)}`);
  return language;
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

class LspClient {
  constructor(command, args, cwd, timeout) {
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.timeout = timeout;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = [];
    this.notificationWaiters = [];
    this.buffer = Buffer.alloc(0);
    this.stderr = "";
    this.workspaceFolder = { uri: pathToFileURL(cwd).href, name: path.basename(cwd) };
  }

  start() {
    this.child = spawn(this.command, this.args, {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.on("data", (chunk) => this.onData(chunk));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-8000);
    });
    this.child.on("error", (error) => this.rejectAll(error));
    this.child.on("exit", (code, signal) => {
      if (this.pending.size > 0) {
        this.rejectAll(new Error(`Language server exited (${code ?? signal}). ${this.stderr.trim()}`));
      }
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const boundary = this.buffer.indexOf("\r\n\r\n");
      if (boundary < 0) return;
      const header = this.buffer.subarray(0, boundary).toString("ascii");
      const length = Number.parseInt(header.match(/Content-Length:\s*(\d+)/i)?.[1] ?? "", 10);
      if (!Number.isInteger(length)) fail(`Invalid LSP header: ${header}`);
      const messageEnd = boundary + 4 + length;
      if (this.buffer.length < messageEnd) return;
      const body = this.buffer.subarray(boundary + 4, messageEnd).toString("utf8");
      this.buffer = this.buffer.subarray(messageEnd);
      this.onMessage(JSON.parse(body));
    }
  }

  onMessage(message) {
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
      return;
    }

    if (message.id !== undefined && message.method) {
      this.handleServerRequest(message);
      return;
    }

    if (message.method) {
      const notification = { method: message.method, params: message.params };
      this.notifications.push(notification);
      for (const waiter of [...this.notificationWaiters]) {
        if (waiter.method === message.method && waiter.predicate(message.params)) {
          clearTimeout(waiter.timer);
          this.notificationWaiters.splice(this.notificationWaiters.indexOf(waiter), 1);
          waiter.resolve(message.params);
        }
      }
    }
  }

  handleServerRequest(message) {
    let result;
    switch (message.method) {
      case "workspace/configuration":
        result = (message.params?.items ?? []).map(() => null);
        break;
      case "workspace/workspaceFolders":
        result = [this.workspaceFolder];
        break;
      case "client/registerCapability":
      case "client/unregisterCapability":
      case "window/workDoneProgress/create":
        result = null;
        break;
      default:
        this.send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } });
        return;
    }
    this.send({ jsonrpc: "2.0", id: message.id, result });
  }

  send(message) {
    const body = JSON.stringify(message);
    this.child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  request(method, params, timeout = this.timeout) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeout} ms`));
      }, timeout);
      this.pending.set(id, { method, resolve, reject, timer });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method, params) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  waitForNotification(method, predicate, timeout) {
    const existing = this.notifications.find((item) => item.method === method && predicate(item.params));
    if (existing) return Promise.resolve(existing.params);
    return new Promise((resolve, reject) => {
      const waiter = { method, predicate, resolve, reject };
      waiter.timer = setTimeout(() => {
        this.notificationWaiters.splice(this.notificationWaiters.indexOf(waiter), 1);
        reject(new Error(`${method} notification timed out after ${timeout} ms`));
      }, timeout);
      this.notificationWaiters.push(waiter);
    });
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  async close() {
    if (!this.child || this.child.exitCode !== null) return;
    try {
      await this.request("shutdown", null, 3000);
      this.notify("exit");
    } catch {
      this.child.kill("SIGTERM");
    }
  }
}

async function main() {
  const { operation, values } = parseArgs(process.argv.slice(2));
  const known = POSITION_OPERATIONS.has(operation)
    || FILE_OPERATIONS.has(operation)
    || ["workspace-symbols", "diagnostics", "capabilities"].includes(operation);
  if (!known) fail(`Unknown operation: ${operation}\n\n${usage()}`);

  const needsFile = POSITION_OPERATIONS.has(operation)
    || FILE_OPERATIONS.has(operation)
    || operation === "diagnostics"
    || operation === "workspace-symbols";
  if (needsFile && !values.file) fail(`Operation ${operation} requires --file PATH`);
  const file = values.file ? path.resolve(values.file) : null;
  if (file && !(await exists(file))) fail(`File does not exist: ${file}`);

  const root = await resolveRoot(values.root, file);
  const tsc = await resolveTsc(values.tsc, root, file);
  const timeout = Number.parseInt(values.timeout ?? "30000", 10);
  if (!Number.isInteger(timeout) || timeout < 1000) fail("--timeout must be an integer of at least 1000 ms");

  const client = new LspClient(tsc.command, ["--lsp", "--stdio"], root, timeout);
  client.start();

  try {
    const initialize = await client.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "codex-typescript-lsp-skill", version: "1.0.0" },
      rootUri: pathToFileURL(root).href,
      workspaceFolders: [client.workspaceFolder],
      capabilities: {
        general: { positionEncodings: ["utf-16"] },
        workspace: {
          workspaceFolders: true,
          symbol: { resolveSupport: { properties: ["location.range"] } },
        },
        textDocument: {
          definition: { linkSupport: true },
          typeDefinition: { linkSupport: true },
          implementation: { linkSupport: true },
          hover: { contentFormat: ["markdown", "plaintext"] },
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          publishDiagnostics: { relatedInformation: true, versionSupport: true },
        },
      },
    });
    client.notify("initialized", {});

    if (operation === "capabilities") {
      emit({ operation, root, server: tsc, result: initialize });
      return;
    }

    let text;
    let uri;
    if (file) {
      text = await readFile(file, "utf8");
      uri = pathToFileURL(file).href;
      client.notify("textDocument/didOpen", {
        textDocument: { uri, languageId: languageId(file), version: 1, text },
      });
    }

    let result;
    let position;
    if (POSITION_OPERATIONS.has(operation)) {
      position = resolvePosition(text, values);
      const params = { textDocument: { uri }, position };
      if (operation === "references") params.context = { includeDeclaration: true };
      result = await client.request(POSITION_OPERATIONS.get(operation), params);
    } else if (FILE_OPERATIONS.has(operation)) {
      result = await client.request(FILE_OPERATIONS.get(operation), { textDocument: { uri } });
    } else if (operation === "workspace-symbols") {
      if (values.query === undefined) fail("Operation workspace-symbols requires --query TEXT");
      result = await client.request("workspace/symbol", { query: values.query });
    } else if (operation === "diagnostics") {
      if (initialize.capabilities?.diagnosticProvider) {
        result = await client.request("textDocument/diagnostic", { textDocument: { uri } });
      } else {
        result = await client.waitForNotification(
          "textDocument/publishDiagnostics",
          (params) => params?.uri === uri,
          Math.min(timeout, 10000),
        );
      }
    }

    emit({
      operation,
      root,
      server: tsc,
      file,
      position: position ? { line: position.line + 1, column: position.character + 1 } : undefined,
      result,
    });
  } finally {
    await client.close();
  }
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(normalize(value), null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`typescript-lsp: ${error.message}\n`);
  process.exitCode = 1;
});
