import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { renderAll } from "./render.js";
import { VERSION } from "./version.js";

export const LOCK_FILE = ".lean-agents.lock.json";
const LEGACY_LOCK_FILE = ".codex/lean-agents.lock.json"; // v0.1

// Line endings are normalized so a Windows checkout (core.autocrlf) is not
// mistaken for a hand edit.
export const hash = (text) => crypto.createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");

export function readLock(root) {
  let file = path.join(root, LOCK_FILE);
  if (!fs.existsSync(file)) file = path.join(root, LEGACY_LOCK_FILE);
  if (!fs.existsSync(file)) return { version: null, files: {} };
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { version: null, files: {} };
  }
}

function backupPath(abs) {
  let candidate = `${abs}.bak`;
  for (let i = 1; fs.existsSync(candidate); i++) candidate = `${abs}.bak${i}`;
  return candidate;
}

// Plans and (unless dryRun) applies the generated files.
//
// Safety model:
// - new file                       -> create
// - managed and untouched          -> update in place
// - managed but edited by hand     -> skip (or backup + overwrite with force)
// - existing file we never wrote   -> skip (or backup + overwrite with force)
// - managed file no longer needed  -> delete if untouched, otherwise keep
export function sync(root, cfg, { force = false, dryRun = false } = {}) {
  const lock = readLock(root);
  const desired = renderAll(cfg);
  const actions = [];

  for (const [rel, content] of Object.entries(desired)) {
    const abs = path.join(root, rel);
    const want = hash(content);
    if (!fs.existsSync(abs)) {
      actions.push({ type: "create", rel, content, hash: want });
      continue;
    }
    const current = hash(fs.readFileSync(abs, "utf8"));
    if (current === want) {
      actions.push({ type: "unchanged", rel, hash: want });
    } else if (lock.files[rel] && lock.files[rel] === current) {
      actions.push({ type: "update", rel, content, hash: want });
    } else if (force) {
      actions.push({ type: "overwrite", rel, content, hash: want, backup: backupPath(abs) });
    } else {
      const why = lock.files[rel] ? "edited by hand since last sync" : "exists and was not created by lean-agents";
      actions.push({ type: "skip", rel, reason: why, hash: lock.files[rel] });
    }
  }

  for (const [rel, lockedHash] of Object.entries(lock.files)) {
    if (rel in desired) continue;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    const current = hash(fs.readFileSync(abs, "utf8"));
    if (current === lockedHash) actions.push({ type: "delete", rel });
    else actions.push({ type: "orphan", rel, reason: "no longer generated, but edited by hand; left in place" });
  }

  if (!dryRun) {
    const nextLock = { version: VERSION, files: {} };
    for (const a of actions) {
      const abs = path.join(root, a.rel);
      if (a.type === "create" || a.type === "update" || a.type === "overwrite") {
        if (a.type === "overwrite") fs.copyFileSync(abs, a.backup);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, a.content);
        nextLock.files[a.rel] = a.hash;
      } else if (a.type === "unchanged") {
        nextLock.files[a.rel] = a.hash;
      } else if (a.type === "skip" && a.hash) {
        nextLock.files[a.rel] = a.hash; // keep tracking so a later --force can restore it
      } else if (a.type === "delete") {
        fs.rmSync(abs);
        removeEmptyDirs(root, path.dirname(abs));
      }
    }
    fs.writeFileSync(path.join(root, LOCK_FILE), JSON.stringify(nextLock, null, 2) + "\n");
    const legacy = path.join(root, LEGACY_LOCK_FILE);
    if (fs.existsSync(legacy)) {
      fs.rmSync(legacy);
      removeEmptyDirs(root, path.dirname(legacy));
    }
  }
  return actions;
}

function removeEmptyDirs(root, dir) {
  const stop = path.resolve(root);
  let current = path.resolve(dir);
  while (current.startsWith(stop) && current !== stop) {
    if (fs.readdirSync(current).length) return;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}
