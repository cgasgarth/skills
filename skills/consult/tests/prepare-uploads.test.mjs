import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { randomFillSync } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareUploadPaths } from "../scripts/prepare-uploads.mjs";

const roots = [];

function testRoot() {
  const root = mkdtempSync(join(tmpdir(), "consult-upload-test-"));
  roots.push(root);
  return root;
}

function randomFile(path, size) {
  const bytes = Buffer.alloc(size);
  randomFillSync(bytes);
  writeFileSync(path, bytes);
}

function zipEntries(path) {
  const result = spawnSync("unzip", ["-Z1", path], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim().split("\n").filter(Boolean);
}

function readZipEntry(path, entry) {
  const result = spawnSync("unzip", ["-p", path, entry]);
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout));
  return result.stdout;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("prepareUploadPaths", () => {
  it("keeps fitting files unchanged and reports their absolute source paths", () => {
    const root = testRoot();
    const file = join(root, "notes.txt");
    writeFileSync(file, "hello");

    const prepared = prepareUploadPaths(file);
    const canonicalFile = realpathSync(file);
    expect(prepared.files).toHaveLength(1);
    expect(prepared.files[0]).not.toBe(canonicalFile);
    expect(prepared.files[0].endsWith("notes.txt")).toBe(true);
    expect(readFileSync(prepared.files[0], "utf8")).toBe("hello");
    expect(prepared.sources).toEqual([{
      sourcePath: canonicalFile,
      sourceType: "file",
      uploads: [{ name: "notes.txt", sizeBytes: 5 }],
    }]);
    const snapshot = prepared.files[0];
    prepared.cleanup();
    expect(existsSync(snapshot)).toBe(false);
    expect(existsSync(file)).toBe(true);
  });

  it("gives same-named files unique upload names", () => {
    const root = testRoot();
    const firstDirectory = join(root, "first");
    const secondDirectory = join(root, "second");
    mkdirSync(firstDirectory);
    mkdirSync(secondDirectory);
    const first = join(firstDirectory, "report.txt");
    const second = join(secondDirectory, "report.txt");
    writeFileSync(first, "first");
    writeFileSync(second, "second");

    const prepared = prepareUploadPaths([first, second]);
    expect(prepared.sources.flatMap((source) => source.uploads.map((upload) => upload.name))).toEqual([
      "report.txt",
      "report-2.txt",
    ]);
    expect(prepared.files.map((path) => readFileSync(path, "utf8"))).toEqual(["first", "second"]);
    prepared.cleanup();
  });

  it("archives a folder, including hidden files and empty directories", () => {
    const root = testRoot();
    const folder = join(root, "project files");
    mkdirSync(join(folder, "empty"), { recursive: true });
    writeFileSync(join(folder, ".env.example"), "SAFE=value\n");
    writeFileSync(join(folder, "read me.txt"), "contents\n");

    const prepared = prepareUploadPaths([folder]);
    expect(prepared.files).toHaveLength(1);
    expect(prepared.files[0].endsWith("project files.zip")).toBe(true);
    expect(zipEntries(prepared.files[0])).toEqual(expect.arrayContaining([
      "project files/",
      "project files/empty/",
      "project files/.env.example",
      "project files/read me.txt",
    ]));
    const archive = prepared.files[0];
    prepared.cleanup();
    expect(existsSync(archive)).toBe(false);
  });

  it("splits an oversized folder into independent ZIP archives below the limit", () => {
    const root = testRoot();
    const folder = join(root, "large-folder");
    mkdirSync(folder);
    randomFile(join(folder, "one.bin"), 40_000);
    randomFile(join(folder, "two.bin"), 40_000);
    randomFile(join(folder, "three.bin"), 40_000);

    const prepared = prepareUploadPaths(folder, { maxUploadBytes: 64_000 });
    expect(prepared.files.length).toBeGreaterThan(1);
    for (const [index, archive] of prepared.files.entries()) {
      expect(archive.endsWith(`large-folder.part-00${index + 1}.zip`)).toBe(true);
      expect(readFileSync(archive).byteLength).toBeLessThanOrEqual(64_000);
      expect(zipEntries(archive).length).toBeGreaterThan(0);
    }
    const allEntries = prepared.files.flatMap(zipEntries);
    expect(allEntries).toEqual(expect.arrayContaining([
      "large-folder/one.bin",
      "large-folder/two.bin",
      "large-folder/three.bin",
    ]));
    prepared.cleanup();
  });

  it("splits one oversized file into bounded ZIP chunks with manifests", () => {
    const root = testRoot();
    const file = join(root, "huge.dat");
    randomFile(file, 110_000);

    const prepared = prepareUploadPaths(file, { maxUploadBytes: 64_000 });
    expect(prepared.files.length).toBeGreaterThan(1);
    const chunks = [];
    for (const archive of prepared.files) {
      expect(readFileSync(archive).byteLength).toBeLessThanOrEqual(64_000);
      const entries = zipEntries(archive);
      expect(entries.some((entry) => entry.startsWith("consult-upload-manifest-"))).toBe(true);
      const [chunkEntry] = entries.filter((entry) => !entry.startsWith("consult-upload-manifest-"));
      chunks.push(readZipEntry(archive, chunkEntry));
    }
    expect(Buffer.concat(chunks)).toEqual(readFileSync(file));
    prepared.cleanup();
  });

  it("accounts for ZIP metadata when a folder contains many tiny files", () => {
    const root = testRoot();
    const folder = join(root, "many-files");
    mkdirSync(folder);
    for (let index = 0; index < 100; index += 1) {
      writeFileSync(join(folder, `${String(index).padStart(3, "0")}.txt`), "");
    }

    const prepared = prepareUploadPaths(folder, { maxUploadBytes: 16_384 });
    expect(prepared.files.length).toBeGreaterThan(1);
    expect(prepared.files.every((archive) => readFileSync(archive).byteLength <= 16_384)).toBe(true);
    expect(prepared.files.flatMap(zipEntries).filter((entry) => entry.endsWith(".txt"))).toHaveLength(100);
    prepared.cleanup();
  });

  it("rejects relative paths and limits above the 512 MB hard cap", () => {
    expect(() => prepareUploadPaths("relative/file.txt")).toThrow("must be absolute");
    expect(() => prepareUploadPaths([], { maxUploadBytes: 512_000_001 })).toThrow("512000000");
  });
});
