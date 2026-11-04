import test from "node:test";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { runDoctor } from "../src/doctor.js";
import { sync } from "../src/sync.js";
import { writeInitialConfig } from "../src/init.js";
import { readConfig } from "../src/config.js";
import { PRESETS } from "../src/presets.js";
import { tmpdir, write, read, baseAnswers, ids } from "./helpers.js";

// A synthetic setup reproducing the mistakes lean-agents was built to catch.
function brokenProject() {
  const root = tmpdir();
  write(root, "AGENTS.md", "# Rules\n- Never send user data to third parties.\n");
  write(root, "AGENTS.override.md", "# Director\nThe main agent acts as director and delegates to roles.\nUse `.codex/skills/git-workflow/SKILL.md` and `.codex/skills/missing-one/SKILL.md`.\n");
  write(
    root,
    ".codex/config.toml",
    'model = "gpt-6-luna"\nmodel_reasoning_effort = "xhigh"\nsandbox_mode = "yolo"\n\n[agents]\nthreads = 2\nmax_depth = 3\ndepth_limit = 1\n'
  );
  write(root, ".codex/agents/qa.toml", 'name = "qa"\ndescription = "Reviewer"\nmodel = "gpt-6-luna"\ndeveloper_instructions = """\nFind problems. Do not modify files.\n"""\n');
  write(root, ".codex/agents/adr.toml", 'name = "adr"\ndescription = "ADR writer"\nmodel = "gpt-6.1-sol"\ndeveloper_instructions = "Write ADRs using skill `architecture-decision-records`."\n');
  write(root, ".codex/agents/dup.toml", 'name = "qa"\ndescription = "dup"\nsandbox_mode = "yolo"\nmodel_reasoning_effort = "ultra-max"\ndeveloper_instructions = "x"\n');
  write(root, ".codex/agents/incomplete.toml", 'name = "incomplete"\n');
  write(root, ".codex/agents/bad.toml", "name = = broken");
  write(root, ".codex/skills/git-workflow/SKILL.md", "---\nname: git-workflow\ndescription: git\n---\n");
  write(root, ".agents/skills/no-frontmatter/SKILL.md", "# nothing here\n");
  write(root, ".agents/skills/folder-a/SKILL.md", "---\nname: other-name\ndescription: mismatch\n---\n");
  write(root, ".gitignore", "/AGENTS.md\nnode_modules\n");
  return root;
}

test("doctor flags every known mistake in a broken setup", () => {
  const { findings } = runDoctor(brokenProject());
  const found = new Set(ids(findings));
  for (const id of ["LA001", "LA010", "LA012", "LA020", "LA030", "LA031", "LA032", "LA034", "LA036", "LA038", "LA040", "LA041", "LA042", "LA043", "LA050"]) {
    assert.ok(found.has(id), `expected ${id}, got ${[...found].join(", ")}`);
  }
  const unknownKeys = findings.filter((f) => f.id === "LA020").map((f) => f.message);
  assert.equal(unknownKeys.length, 3);
  assert.ok(unknownKeys.some((m) => m.includes("[agents].threads") && m.includes("max_concurrent_threads_per_session")));
  assert.ok(unknownKeys.some((m) => m.includes("[agents].max_depth") && m.includes("no depth limit")));
  const refs = findings.filter((f) => f.id === "LA043").map((f) => f.message).join("\n");
  assert.match(refs, /git-workflow.*outside \.agents\/skills/);
  assert.match(refs, /missing-one/);
  assert.match(refs, /architecture-decision-records/);
});

test("findings are sorted errors first", () => {
  const { findings } = runDoctor(brokenProject());
  const order = findings.map((f) => f.severity);
  const firstWarn = order.indexOf("warn");
  const lastError = order.lastIndexOf("error");
  assert.ok(lastError < firstWarn);
});

test("override alone (no AGENTS.md beside it) is not an error", () => {
  const root = tmpdir();
  write(root, "AGENTS.override.md", "# Just rules\n");
  assert.ok(!ids(runDoctor(root).findings).includes("LA010"));
});

test("oversized instructions are reported", () => {
  const root = tmpdir();
  write(root, "AGENTS.md", "x".repeat(40 * 1024));
  const f = runDoctor(root).findings.find((x) => x.id === "LA011");
  assert.equal(f?.severity, "warn");
});

const codexFindings = (config, agent) => {
  const root = tmpdir();
  write(root, ".codex/config.toml", config);
  if (agent !== undefined) write(root, ".codex/agents/a.toml", `name = "a"\ndescription = "d"\ndeveloper_instructions = "x"\n${agent}`);
  return runDoctor(root).findings;
};

test("every documented [agents] key is accepted", () => {
  const config = '[agents]\nenabled = true\nmax_concurrent_threads_per_session = 2\ndefault_subagent_model = "gpt-6-luna"\ndefault_subagent_reasoning_effort = "high"\ninterrupt_message = false\n\n[agents.custom]\ndescription = "x"\n';
  assert.deepEqual(codexFindings(config), []);
});

test("max_threads still counts as the limit but is reported as legacy", () => {
  const found = codexFindings("[agents]\nmax_threads = 9\n", "");
  assert.equal(found.find((f) => f.id === "LA024")?.severity, "info");
  assert.equal(found.find((f) => f.id === "LA022")?.severity, "info");
  assert.ok(!ids(found).includes("LA020"));
  assert.ok(!ids(found).includes("LA023"));
});

test("a missing thread limit is reported with the current key", () => {
  const f = codexFindings('model = "gpt-6.1-sol"\n', "").find((x) => x.id === "LA023");
  assert.match(f.message, /max_concurrent_threads_per_session/);
  assert.match(f.message, /Codex chooses/);
});

test("documented reasoning levels pass and others warn", () => {
  for (const level of ["low", "medium", "high", "xhigh", "max", "ultra"]) {
    assert.ok(!ids(codexFindings(`model_reasoning_effort = "${level}"\n`)).includes("LA034"), level);
  }
  assert.ok(ids(codexFindings('model_reasoning_effort = "minimal"\n')).includes("LA034"));
});

test("sandbox_mode is checked at session level", () => {
  assert.equal(codexFindings('sandbox_mode = "yolo"\n').find((f) => f.id === "LA032")?.severity, "error");
  assert.equal(codexFindings('sandbox_mode = "danger-full-access"\n').find((f) => f.id === "LA033")?.severity, "warn");
  assert.deepEqual(codexFindings('sandbox_mode = "read-only"\n'), []);
});

test("settings Codex ignores in a custom agent file are reported", () => {
  const agent = 'sandbox_mode = "read-only"\napproval_policy = "never"\nmodel_provider = "x"\nservice_tier = "flex"\n\n[mcp_servers.docs]\ncommand = "x"\n';
  const found = codexFindings("[agents]\nmax_concurrent_threads_per_session = 2\n", agent).filter((f) => f.id === "LA038");
  assert.equal(found.length, 5);
  assert.equal(found[0].severity, "warn");
  assert.equal(found[0].file, ".codex/agents/a.toml");
});

test("a role told not to edit needs no sandbox_mode in its file", () => {
  const agent = 'model = "gpt-6-luna"\n';
  const root = tmpdir();
  write(root, ".codex/config.toml", "[agents]\nmax_concurrent_threads_per_session = 2\n");
  write(root, ".codex/agents/a.toml", `name = "a"\ndescription = "d"\ndeveloper_instructions = "Do not edit files."\n${agent}`);
  assert.deepEqual(runDoctor(root).findings, []);
});

for (const preset of Object.keys(PRESETS)) {
  for (const language of ["en", "es"]) {
    test(`a freshly generated ${preset}/${language} project has no errors or warnings`, () => {
      const root = tmpdir();
      writeInitialConfig(root, baseAnswers({ preset, language }));
      sync(root, readConfig(root));
      const bad = runDoctor(root).findings.filter((f) => f.severity !== "info");
      assert.deepEqual(bad, []);
    });
  }
}

test("doctor reports generated files that drifted from orchestration.toml", () => {
  const root = tmpdir();
  writeInitialConfig(root, baseAnswers());
  sync(root, readConfig(root));
  write(root, "orchestration.toml", read(root, "orchestration.toml").replace("max_threads = 2", "max_threads = 1"));
  const drift = runDoctor(root).findings.find((f) => f.id === "LA060" && f.severity === "warn");
  assert.ok(drift, "expected an out-of-sync warning");
  assert.match(drift.message, /\.codex\/config\.toml/);
});

test("doctor reports unknown orchestration.toml keys as warnings", () => {
  const root = tmpdir();
  writeInitialConfig(root, baseAnswers());
  write(root, "orchestration.toml", read(root, "orchestration.toml").replace("max_threads = 2", 'max_threads = 2\ndelegaton = "explicit"'));
  sync(root, readConfig(root));
  const { findings } = runDoctor(root);
  assert.deepEqual(ids(findings), ["LA003"]);
  assert.equal(findings[0].severity, "warn");
  assert.equal(findings[0].rule, "orchestration-unknown-key");
  assert.equal(findings[0].file, "orchestration.toml");
  assert.match(findings[0].message, /`delegaton` does not exist, did you mean `delegation`\?/);
});

test("doctor reports unknown keys even when the config has errors", () => {
  const root = tmpdir();
  write(root, "orchestration.toml", 'preset = "huge"\n[role.pagos]\ndescription = "x"\n');
  const found = ids(runDoctor(root).findings);
  assert.ok(found.includes("LA002"));
  assert.ok(found.includes("LA003"));
});

test("the bundled sts-to-tts example is in sync and clean", () => {
  const root = fileURLToPath(new URL("../examples/sts-to-tts", import.meta.url));
  const bad = runDoctor(root).findings;
  assert.deepEqual(bad, []);
});
