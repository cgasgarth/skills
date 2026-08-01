import { spawnSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative } from "node:path";

export const MAX_UPLOAD_BYTES = 512_000_000;
const ZIP_ARGUMENT_BATCH_SIZE = 250;

function safeUploadLimit(value) {
  if (!Number.isSafeInteger(value) || value < 16_384 || value > MAX_UPLOAD_BYTES) {
    throw new Error(
      `maxUploadBytes must be an integer from 16384 through ${MAX_UPLOAD_BYTES}.`,
    );
  }
  return value;
}

function zipPayloadLimit(maxUploadBytes) {
  const reserve = Math.min(
    Math.max(4_096, Math.floor(maxUploadBytes * 0.02)),
    8_000_000,
  );
  return maxUploadBytes - reserve;
}

function normalizeSourcePaths(paths) {
  const values = typeof paths === "string" ? [paths] : paths;
  if (!Array.isArray(values)) throw new Error("paths must be an absolute path or an array of absolute paths.");

  return values.map((value) => {
    if (typeof value !== "string" || !isAbsolute(value)) {
      throw new Error(`Consult attachment paths must be absolute: ${JSON.stringify(value)}.`);
    }
    try {
      return realpathSync(value);
    } catch (error) {
      throw new Error(`Consult attachment path is unavailable: ${value}.`, { cause: error });
    }
  });
}

function runZip(archivePath, cwd, relativePaths) {
  if (relativePaths.length === 0) throw new Error("Cannot create an empty ZIP without a directory entry.");

  for (let index = 0; index < relativePaths.length; index += ZIP_ARGUMENT_BATCH_SIZE) {
    const batch = relativePaths.slice(index, index + ZIP_ARGUMENT_BATCH_SIZE);
    const result = spawnSync(
      "zip",
      ["-q", "-y", archivePath, "--", ...batch],
      { cwd, encoding: "utf8", maxBuffer: 1_048_576 },
    );
    if (result.error) {
      throw new Error("The consult skill requires the system `zip` command to archive folders.", {
        cause: result.error,
      });
    }
    if (result.status !== 0) {
      const detail = String(result.stderr || result.stdout || "unknown zip error").trim();
      throw new Error(`Could not create ${archivePath}: ${detail}`);
    }
  }
}

function collectDirectory(rootPath) {
  const rootParent = dirname(rootPath);
  const rootName = basename(rootPath);
  if (!rootName) throw new Error(`Cannot archive a filesystem root: ${rootPath}.`);

  const archiveEntries = [{ archivePath: rootName, sizeBytes: 0, type: "directory" }];
  const visit = (absoluteDirectory) => {
    const entries = readdirSync(absoluteDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryName = entry.name;
      const absolutePath = join(absoluteDirectory, entryName);
      const archivePath = relative(rootParent, absolutePath);
      const info = lstatSync(absolutePath);
      if (info.isDirectory()) {
        archiveEntries.push({ archivePath, sizeBytes: 0, type: "directory" });
        visit(absolutePath);
      } else if (info.isFile() || info.isSymbolicLink()) {
        const file = { absolutePath, archivePath, sizeBytes: info.size, type: "file" };
        archiveEntries.push(file);
      } else {
        throw new Error(`Unsupported special file in consult attachment folder: ${absolutePath}.`);
      }
    }
  };
  visit(rootPath);
  return { rootParent, rootName, archiveEntries };
}

function estimatedZipEntryBytes(entry) {
  return entry.sizeBytes + 512 + Buffer.byteLength(entry.archivePath, "utf8") * 2;
}

function groupEntries(entries, payloadLimit) {
  const groups = [];
  let group = [];
  let groupBytes = 0;
  const oversized = [];

  for (const entry of entries) {
    const estimatedBytes = estimatedZipEntryBytes(entry);
    if (entry.type === "file" && estimatedBytes > payloadLimit) {
      oversized.push(entry);
      continue;
    }
    if (group.length > 0 && groupBytes + estimatedBytes > payloadLimit) {
      groups.push(group);
      group = [];
      groupBytes = 0;
    }
    group.push(entry);
    groupBytes += estimatedBytes;
  }
  if (group.length > 0) groups.push(group);
  return { groups, oversized };
}

function copyFileRange(sourcePath, destinationPath, offset, length) {
  mkdirSync(dirname(destinationPath), { recursive: true });
  const source = openSync(sourcePath, "r");
  const destination = openSync(destinationPath, "w", 0o600);
  const buffer = Buffer.allocUnsafe(Math.min(1_048_576, length));
  let remaining = length;
  let position = offset;
  try {
    while (remaining > 0) {
      const bytesRead = readSync(source, buffer, 0, Math.min(buffer.length, remaining), position);
      if (bytesRead === 0) throw new Error(`Unexpected end of file while splitting ${sourcePath}.`);
      let written = 0;
      while (written < bytesRead) {
        written += writeSync(destination, buffer, written, bytesRead - written);
      }
      remaining -= bytesRead;
      position += bytesRead;
    }
  } finally {
    closeSync(source);
    closeSync(destination);
  }
}

function splitFileIntoArchives({
  file,
  archiveRoot,
  stagingRoot,
  payloadLimit,
  maxUploadBytes,
  archivePrefix,
}) {
  const partCount = Math.ceil(file.sizeBytes / payloadLimit);
  const width = Math.max(3, String(partCount).length);
  const archives = [];

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const number = String(partIndex + 1).padStart(width, "0");
    const suffix = `.part-${number}-of-${String(partCount).padStart(width, "0")}`;
    const chunkRelativePath = `${file.archivePath}${suffix}`;
    const chunkPath = join(stagingRoot, chunkRelativePath);
    const offset = partIndex * payloadLimit;
    const length = Math.min(payloadLimit, file.sizeBytes - offset);
    copyFileRange(file.absolutePath, chunkPath, offset, length);

    const manifestName = `consult-upload-manifest-${number}.txt`;
    const manifestPath = join(stagingRoot, manifestName);
    writeFileSync(
      manifestPath,
      [
        `Archived entry: ${file.archivePath}`,
        `Chunk: ${partIndex + 1} of ${partCount}`,
        `Byte range: ${offset}-${offset + length - 1}`,
        "Reassemble chunks in numeric order to recover the original file.",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );

    const archivePath = join(archiveRoot, `${archivePrefix}-${number}.zip`);
    runZip(archivePath, stagingRoot, [chunkRelativePath, manifestName]);
    rmSync(chunkPath, { force: true });
    rmSync(manifestPath, { force: true });
    const archiveBytes = statSync(archivePath).size;
    if (archiveBytes > maxUploadBytes) {
      throw new Error(`Generated ZIP exceeds the ${maxUploadBytes}-byte upload limit: ${archivePath}.`);
    }
    archives.push(archivePath);
  }
  return archives;
}

function finalizeArchiveNames(archives, outputRoot, rootName) {
  const width = Math.max(3, String(archives.length).length);
  return archives.map((archivePath, index) => {
    const name = archives.length === 1
      ? `${rootName}.zip`
      : `${rootName}.part-${String(index + 1).padStart(width, "0")}.zip`;
    const finalPath = join(outputRoot, name);
    renameSync(archivePath, finalPath);
    return finalPath;
  });
}

function archiveDirectory(rootPath, outputRoot, maxUploadBytes) {
  const payloadLimit = zipPayloadLimit(maxUploadBytes);
  const collected = collectDirectory(rootPath);
  const archiveRoot = join(outputRoot, "archives");
  const stagingRoot = join(outputRoot, "chunks");
  mkdirSync(archiveRoot, { recursive: true });
  mkdirSync(stagingRoot, { recursive: true });

  const { groups, oversized } = groupEntries(collected.archiveEntries, payloadLimit);
  if (groups.length === 0 && oversized.length === 0) groups.push([]);
  const archives = [];
  let archiveSequence = 0;
  let chunkSequence = 0;

  const materializeGroup = (entries) => {
    archiveSequence += 1;
    const archivePath = join(archiveRoot, `group-${String(archiveSequence).padStart(4, "0")}.zip`);
    const paths = entries.map((entry) => entry.archivePath);
    runZip(archivePath, collected.rootParent, paths);
    if (statSync(archivePath).size <= maxUploadBytes) return [archivePath];

    rmSync(archivePath, { force: true });
    if (entries.length === 1 && entries[0].type === "file") {
      chunkSequence += 1;
      return splitFileIntoArchives({
        file: entries[0],
        archiveRoot,
        stagingRoot,
        payloadLimit,
        maxUploadBytes,
        archivePrefix: `chunk-${String(chunkSequence).padStart(4, "0")}`,
      });
    }
    if (entries.length <= 1) {
      throw new Error(`A folder entry cannot fit within the ${maxUploadBytes}-byte upload limit: ${rootPath}.`);
    }
    const middle = Math.ceil(entries.length / 2);
    return [...materializeGroup(entries.slice(0, middle)), ...materializeGroup(entries.slice(middle))];
  };

  for (const group of groups) {
    archives.push(...materializeGroup(group));
  }

  for (const file of oversized) {
    chunkSequence += 1;
    archives.push(...splitFileIntoArchives({
      file,
      archiveRoot,
      stagingRoot,
      payloadLimit,
      maxUploadBytes,
      archivePrefix: `chunk-${String(chunkSequence).padStart(4, "0")}`,
    }));
  }
  return finalizeArchiveNames(archives, outputRoot, collected.rootName);
}

function archiveOversizedFile(filePath, outputRoot, maxUploadBytes) {
  const file = {
    absolutePath: filePath,
    archivePath: basename(filePath),
    sizeBytes: statSync(filePath).size,
  };
  const archiveRoot = join(outputRoot, "archives");
  const stagingRoot = join(outputRoot, "chunks");
  mkdirSync(archiveRoot, { recursive: true });
  mkdirSync(stagingRoot, { recursive: true });
  const archives = splitFileIntoArchives({
    file,
    archiveRoot,
    stagingRoot,
    payloadLimit: zipPayloadLimit(maxUploadBytes),
    maxUploadBytes,
    archivePrefix: "chunk-0001",
  });
  return finalizeArchiveNames(archives, outputRoot, basename(filePath));
}

function publicSource(source) {
  return {
    sourcePath: source.sourcePath,
    sourceType: source.sourceType,
    uploads: source.uploadPaths.map((uploadPath) => ({
      name: basename(uploadPath),
      sizeBytes: statSync(uploadPath).size,
    })),
  };
}

function uniqueUploadPaths(uploadPaths, usedNames) {
  return uploadPaths.map((uploadPath) => {
    const originalName = basename(uploadPath);
    let candidate = originalName;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      const extension = extname(originalName);
      const stem = extension ? originalName.slice(0, -extension.length) : originalName;
      candidate = `${stem}-${suffix}${extension}`;
      suffix += 1;
    }
    usedNames.add(candidate);
    if (candidate === originalName) return uploadPath;
    const renamedPath = join(dirname(uploadPath), candidate);
    renameSync(uploadPath, renamedPath);
    return renamedPath;
  });
}

export function prepareUploadPaths(paths, options = {}) {
  const maxUploadBytes = safeUploadLimit(options.maxUploadBytes ?? MAX_UPLOAD_BYTES);
  const sourcePaths = normalizeSourcePaths(paths ?? []);
  let temporaryRoot;
  const sources = [];
  const usedUploadNames = new Set();

  const ensureTemporaryRoot = () => {
    temporaryRoot ??= mkdtempSync(join(tmpdir(), "codex-consult-uploads-"));
    return temporaryRoot;
  };

  try {
    for (let index = 0; index < sourcePaths.length; index += 1) {
      const sourcePath = sourcePaths[index];
      const info = lstatSync(sourcePath);
      if (info.isDirectory()) {
        const outputRoot = join(ensureTemporaryRoot(), `source-${String(index + 1).padStart(3, "0")}`);
        mkdirSync(outputRoot, { recursive: true });
        const uploadPaths = archiveDirectory(sourcePath, outputRoot, maxUploadBytes);
        sources.push({
          sourcePath,
          sourceType: "folder",
          uploadPaths: uniqueUploadPaths(uploadPaths, usedUploadNames),
        });
      } else if (info.isFile()) {
        const outputRoot = join(ensureTemporaryRoot(), `source-${String(index + 1).padStart(3, "0")}`);
        mkdirSync(outputRoot, { recursive: true });
        const snapshotPath = join(outputRoot, basename(sourcePath));
        copyFileSync(sourcePath, snapshotPath);
        const snapshotBytes = statSync(snapshotPath).size;
        const uploadPaths = snapshotBytes <= maxUploadBytes
          ? [snapshotPath]
          : archiveOversizedFile(snapshotPath, join(outputRoot, "split"), maxUploadBytes);
        if (snapshotBytes > maxUploadBytes) rmSync(snapshotPath, { force: true });
        sources.push({
          sourcePath,
          sourceType: "file",
          uploadPaths: uniqueUploadPaths(uploadPaths, usedUploadNames),
        });
      } else {
        throw new Error(`Consult attachments must be files or folders: ${sourcePath}.`);
      }
    }

    return {
      files: sources.flatMap((source) => source.uploadPaths),
      sources: sources.map(publicSource),
      cleanup() {
        if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}
