import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "smol-toml";
import { normalizeConfig } from "../src/config.js";
import { renderOrchestrationToml } from "../src/init.js";

export function tmpdir(prefix = "lean-agents-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

export function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

export function baseAnswers(overrides = {}) {
  return {
    name: "demo",
    language: "en",
    preset: "standard",
    verify: ["npm test"],
    sources: ["contracts/"],
    docs: {},
    targets: ["claude", "codex"],
    ...overrides,
  };
}

export function configFrom(answers, extraToml = "") {
  return normalizeConfig(parse(renderOrchestrationToml(answers) + "\n" + extraToml));
}

export const ids = (findings) => findings.map((f) => f.id);
