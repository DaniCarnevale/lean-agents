import test from "node:test";
import assert from "node:assert/strict";
import { renderAll } from "../src/render.js";
import { runDoctor, parseFrontmatter } from "../src/doctor.js";
import { sync } from "../src/sync.js";
import { writeInitialConfig } from "../src/init.js";
import { readConfig, normalizeConfig } from "../src/config.js";
import { PRESETS } from "../src/presets.js";
import { tmpdir, write, baseAnswers, configFrom, ids } from "./helpers.js";

const agentOf = (files, name) => parseFrontmatter(files[`.claude/agents/${name}.md`]);

test("claude-only projects get CLAUDE.md with the full instructions and no Codex files", () => {
  const files = renderAll(configFrom(baseAnswers({ targets: ["claude"] })));
  assert.ok(files["CLAUDE.md"].includes("## Orchestration (director only)"));
  assert.ok(!("AGENTS.md" in files));
  assert.ok(!Object.keys(files).some((f) => f.startsWith(".codex/") || f.startsWith(".agents/")));
  assert.ok(".claude/skills/intake/SKILL.md" in files);
});

test("with both tools, CLAUDE.md imports AGENTS.md so there is one source of truth", () => {
  const files = renderAll(configFrom(baseAnswers()));
  const lines = files["CLAUDE.md"].split("\n");
  assert.equal(lines[1], "@AGENTS.md");
  assert.ok(!files["CLAUDE.md"].includes("## Orchestration"));
  assert.ok(files["AGENTS.md"].includes("`.claude/skills/` and `.agents/skills/`"));
});

test("read-only roles get a strict tool allowlist; specialists cannot nest subagents", () => {
  const files = renderAll(
    configFrom(baseAnswers({ targets: ["claude"] }), '[roles.payments]\ndescription = "Payments specialist."\n')
  );
  const reviewer = agentOf(files, "reviewer");
  assert.equal(reviewer.fields.name, "reviewer");
  assert.equal(reviewer.fields.tools, "Read, Grep, Glob");
  assert.equal(reviewer.fields.model, "sonnet");
  assert.equal(reviewer.fields.effort, "high");
  assert.match(reviewer.body, /no terminal/);
  assert.doesNotMatch(reviewer.body, /You may run read-only commands/);
  const payments = agentOf(files, "payments");
  assert.equal(payments.fields.disallowedTools, "Agent");
  assert.equal(payments.fields.model, "opus");
  assert.equal(payments.fields.tools, undefined);
});

test("descriptions carry the delegation policy, since Claude delegates on its own", () => {
  const proactive = agentOf(renderAll(configFrom(baseAnswers({ targets: ["claude"], preset: "standard" }))), "reviewer");
  assert.match(proactive.fields.description, /Use proactively/);
  const explicit = agentOf(renderAll(configFrom(baseAnswers({ targets: ["claude"], preset: "minimal" }))), "reviewer");
  assert.match(explicit.fields.description, /only when the user explicitly asks/);
});

test("settings.json sets the director model, blocks nesting and merges [claude] extras", () => {
  const cfg = configFrom(baseAnswers({ targets: ["claude"] }), '[claude.permissions]\ndeny = ["Read(./.env)"]\n\n[claude.env]\nFOO = "1"\n');
  const settings = JSON.parse(renderAll(cfg)[".claude/settings.json"]);
  assert.equal(settings.model, "opus");
  assert.equal(settings.effortLevel, "high");
  assert.deepEqual(settings.permissions.deny, ["Read(./.env)"]);
  assert.deepEqual(settings.env, { CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "1", FOO: "1" });
});

const directorEffort = (director_effort) =>
  JSON.parse(renderAll(normalizeConfig({ targets: ["claude"], models: { director_effort } }))[".claude/settings.json"]).effortLevel;

test("director_effort reaches effortLevel, using only levels settings accept", () => {
  for (const level of ["low", "medium", "high", "xhigh"]) assert.equal(directorEffort(level), level);
  assert.equal(directorEffort("minimal"), "low");
  assert.equal(directorEffort("max"), "xhigh");
  assert.equal(directorEffort("ultra"), "xhigh");
});

test("a director on max stays clean in doctor and subagents keep max", () => {
  const root = tmpdir();
  write(root, "orchestration.toml", 'targets = ["claude"]\n[models]\ndirector_effort = "max"\n[roles.reviewer]\neffort = "max"\n');
  const cfg = readConfig(root);
  sync(root, cfg);
  assert.deepEqual(runDoctor(root).findings, []);
  assert.equal(agentOf(renderAll(cfg), "reviewer").fields.effort, "max");
});

const settingsFindings = (settings) => {
  const root = tmpdir();
  write(root, "CLAUDE.md", "# x\n");
  write(root, ".claude/settings.json", typeof settings === "string" ? settings : JSON.stringify(settings));
  return runDoctor(root).findings;
};

test("doctor warns about an unknown effortLevel", () => {
  for (const effortLevel of ["turbo", "max", "minimal", 3, null]) {
    const f = settingsFindings({ effortLevel }).find((x) => x.id === "LA122");
    assert.equal(f?.severity, "warn", String(effortLevel));
    assert.equal(f.rule, "claude-invalid-effort-level");
  }
  for (const settings of [{ effortLevel: "xhigh" }, {}, "null", "[]", "1"]) {
    assert.ok(!ids(settingsFindings(settings)).includes("LA122"), JSON.stringify(settings));
  }
});

test("doctor notes that env.CLAUDE_CODE_EFFORT_LEVEL overrides effortLevel", () => {
  const f = settingsFindings({ effortLevel: "high", env: { CLAUDE_CODE_EFFORT_LEVEL: "max" } }).find((x) => x.id === "LA123");
  assert.equal(f?.severity, "info");
  assert.match(f.message, /takes priority over effortLevel/);
  assert.ok(!ids(settingsFindings({ effortLevel: "high", env: {} })).includes("LA123"));
});

for (const targets of [["claude"], ["codex"], ["claude", "codex"]]) {
  for (const preset of Object.keys(PRESETS)) {
    test(`fresh ${targets.join("+")}/${preset} project passes doctor --strict`, () => {
      const root = tmpdir();
      writeInitialConfig(root, baseAnswers({ targets, preset, language: "es" }));
      sync(root, readConfig(root));
      assert.deepEqual(runDoctor(root).findings, []);
    });
  }
}

function brokenClaudeProject() {
  const root = tmpdir();
  write(root, "AGENTS.md", "# Rules\nNever send user data anywhere.\n");
  write(root, "CLAUDE.md", "# Project\nThe director delegates to roles.\nSee `@AGENTS.md` (in code, not an import).\n");
  write(root, ".claude/settings.json", '{ "model": "haiku", }');
  write(root, ".claude/agents/reviewer.md", "---\nname: reviewer\ndescription: Reviews code\nmodel: opus\neffort: turbo\npermissionMode: yolo\n---\nFind problems. Do not modify files.\n");
  write(root, ".claude/agents/dup.md", "---\nname: reviewer\ndescription: dup\nmodel: gpt-6-sol\ntools: [Read, Write]\n---\nRead-only reviewer.\n");
  write(root, ".claude/agents/bad-name.md", "---\nname: ns:bad\n---\nbody\n");
  write(root, ".claude/agents/nofm.md", "just text\n");
  write(root, ".claude/skills/nodesc/SKILL.md", "---\nname: nodesc\n---\nbody\n");
  write(root, ".agents/skills/shared/SKILL.md", "---\nname: shared\ndescription: x\n---\n");
  return root;
}

test("doctor catches Claude Code mistakes", () => {
  const found = new Set(ids(runDoctor(brokenClaudeProject()).findings));
  for (const id of ["LA012", "LA101", "LA110", "LA120", "LA121", "LA130", "LA131", "LA132", "LA133", "LA134", "LA135", "LA136", "LA141"]) {
    assert.ok(found.has(id), `expected ${id}, got ${[...found].join(", ")}`);
  }
});

test("Codex-only skills are reported when the repo also uses Claude Code", () => {
  const root = tmpdir();
  write(root, "CLAUDE.md", "# x\n");
  write(root, ".agents/skills/shared/SKILL.md", "---\nname: shared\ndescription: x\n---\n");
  assert.ok(ids(runDoctor(root).findings).includes("LA140"));
});

test("a weaker default model than a subagent is flagged", () => {
  const root = tmpdir();
  write(root, "CLAUDE.md", "# x\n");
  write(root, ".claude/settings.json", '{ "model": "haiku", "env": { "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "1" } }');
  write(root, ".claude/agents/a.md", "---\nname: a\ndescription: d\nmodel: opus\n---\nbody\n");
  assert.ok(ids(runDoctor(root).findings).includes("LA137"));
});

test("frontmatter parser handles quotes, inline and block lists", () => {
  const { fields, body } = parseFrontmatter('---\nname: x\ndescription: "a \\"quoted\\" value"\ntools: [Read, Grep]\nskills:\n  - one\n  - two\n---\nhello\n');
  assert.equal(fields.description, 'a "quoted" value');
  assert.deepEqual(fields.tools, ["Read", "Grep"]);
  assert.deepEqual(fields.skills, ["one", "two"]);
  assert.equal(body.trim(), "hello");
  assert.equal(parseFrontmatter("no frontmatter"), null);
});
