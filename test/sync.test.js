import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sync, LOCK_FILE } from "../src/sync.js";
import { writeInitialConfig } from "../src/init.js";
import { readConfig } from "../src/config.js";
import { tmpdir, write, read, baseAnswers } from "./helpers.js";

function freshProject(answers) {
  const root = tmpdir();
  writeInitialConfig(root, baseAnswers(answers));
  const actions = sync(root, readConfig(root));
  return { root, actions };
}

test("first sync creates every file and a lock", () => {
  const { root, actions } = freshProject();
  assert.ok(actions.every((a) => a.type === "create"));
  for (const rel of ["AGENTS.md", ".codex/config.toml", ".codex/agents/reviewer.toml", ".codex/agents/explorer.toml", ".agents/skills/intake/SKILL.md", LOCK_FILE]) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
});

test("second sync is a no-op", () => {
  const { root } = freshProject();
  const again = sync(root, readConfig(root));
  assert.ok(again.every((a) => a.type === "unchanged"));
});

test("files edited by hand are protected, and --force keeps a backup", () => {
  const { root } = freshProject();
  write(root, "AGENTS.md", read(root, "AGENTS.md") + "\nmy manual note\n");
  const plan = sync(root, readConfig(root));
  assert.equal(plan.find((a) => a.rel === "AGENTS.md").type, "skip");
  assert.match(read(root, "AGENTS.md"), /my manual note/);

  const forced = sync(root, readConfig(root), { force: true });
  const a = forced.find((x) => x.rel === "AGENTS.md");
  assert.equal(a.type, "overwrite");
  assert.match(fs.readFileSync(a.backup, "utf8"), /my manual note/);
  assert.doesNotMatch(read(root, "AGENTS.md"), /my manual note/);
});

test("existing files not created by lean-agents are never overwritten silently", () => {
  const root = tmpdir();
  write(root, ".codex/config.toml", '[mcp_servers.docs]\ncommand = "docs-mcp"\n');
  writeInitialConfig(root, baseAnswers());
  const plan = sync(root, readConfig(root));
  assert.equal(plan.find((a) => a.rel === ".codex/config.toml").type, "skip");
  assert.match(read(root, ".codex/config.toml"), /docs-mcp/);
});

test("config changes update managed files; removed roles are deleted", () => {
  const { root } = freshProject();
  // init writes the preset's orchestration values explicitly, so they are changed separately.
  const toml = read(root, "orchestration.toml")
    .replace('preset = "standard"', 'preset = "minimal"')
    .replace("max_threads = 2", "max_threads = 1");
  write(root, "orchestration.toml", toml);
  const plan = sync(root, readConfig(root));
  assert.equal(plan.find((a) => a.rel === ".codex/agents/explorer.toml").type, "delete");
  assert.ok(!fs.existsSync(path.join(root, ".codex/agents/explorer.toml")));
  assert.equal(plan.find((a) => a.rel === ".codex/config.toml").type, "update");
  assert.match(read(root, ".codex/config.toml"), /max_concurrent_threads_per_session = 1/);
});

test("dry run writes nothing", () => {
  const root = tmpdir();
  writeInitialConfig(root, baseAnswers());
  sync(root, readConfig(root), { dryRun: true });
  assert.ok(!fs.existsSync(path.join(root, "AGENTS.md")));
  assert.ok(!fs.existsSync(path.join(root, LOCK_FILE)));
});

test("CRLF checkouts are not treated as hand edits", () => {
  const { root } = freshProject();
  write(root, "AGENTS.md", read(root, "AGENTS.md").replace(/\n/g, "\r\n"));
  const plan = sync(root, readConfig(root), { dryRun: true });
  assert.equal(plan.find((a) => a.rel === "AGENTS.md").type, "unchanged");
});
