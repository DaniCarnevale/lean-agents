import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "smol-toml";
import { normalizeConfig, ConfigError } from "../src/config.js";
import { renderAll } from "../src/render.js";
import { detectProject } from "../src/init.js";
import { PRESETS } from "../src/presets.js";
import { DEFAULT_ALIASES } from "../src/models.js";
import { baseAnswers, configFrom, tmpdir, write } from "./helpers.js";

const problemsOf = (raw) => {
  try {
    normalizeConfig(raw);
    return [];
  } catch (err) {
    assert.ok(err instanceof ConfigError);
    return err.problems;
  }
};

test("rejects unknown presets, bad modes and bad roles", () => {
  const problems = problemsOf({
    preset: "huge",
    orchestration: { delegation: "always", max_threads: 9, intake: "maybe" },
    roles: { "Bad-Name": { description: "x" }, nodesc: {}, risky: { description: "x", sandbox: "danger-full-access" } },
  });
  const text = problems.join("\n");
  for (const needle of ["preset", "delegation", "max_threads", "intake", "Bad-Name", "nodesc", "danger-full-access"]) {
    assert.match(text, new RegExp(needle));
  }
});

test("aliases resolve to concrete models and can be overridden", () => {
  const cfg = normalizeConfig({ models: { director: "strong", aliases: { strong: "my-model" } } });
  assert.equal(cfg.director.model, "my-model");
  const reviewer = cfg.roles.find((r) => r.name === "reviewer");
  assert.equal(reviewer.model, DEFAULT_ALIASES.balanced);
});

test("roles can be disabled and custom specialists added", () => {
  const cfg = normalizeConfig({
    preset: "standard",
    roles: { explorer: { enabled: false }, speech_audio: { description: "Audio pipeline specialist.", focus: ["PCM"], model: "fast" } },
  });
  assert.deepEqual(cfg.roles.map((r) => r.name), ["reviewer", "speech_audio"]);
  const sa = cfg.roles.find((r) => r.name === "speech_audio");
  assert.equal(sa.sandbox, "workspace-write");
  assert.equal(sa.model, DEFAULT_ALIASES.fast);
});

test("[codex] settings pass through but cannot override managed keys", () => {
  const cfg = configFrom(baseAnswers(), '[codex]\napproval_policy = "on-request"\n\n[codex.mcp_servers.docs]\ncommand = "docs-mcp"\n');
  const out = parse(renderAll(cfg)[".codex/config.toml"]);
  assert.equal(out.approval_policy, "on-request");
  assert.equal(out.mcp_servers.docs.command, "docs-mcp");
  assert.equal(out.agents.max_depth, 1);
  assert.match(problemsOf({ codex: { agents: { max_threads: 5 } } }).join(), /managed by lean-agents/);
});

for (const preset of Object.keys(PRESETS)) {
  for (const language of ["en", "es"]) {
    test(`${preset}/${language}: every generated TOML parses and agents have required fields`, () => {
      const cfg = configFrom(baseAnswers({ preset, language }), '[roles.payments]\ndescription = "Payments specialist with a \\"quoted\\" word and a \\\\ backslash."\ninstructions = """\nNever log card data. Triple quotes: \\"\\"\\" end.\n"""\n');
      const files = renderAll(cfg);
      for (const [rel, content] of Object.entries(files)) {
        if (!rel.endsWith(".toml")) continue;
        const data = parse(content);
        if (rel.startsWith(".codex/agents/")) {
          for (const field of ["name", "description", "developer_instructions", "sandbox_mode"]) assert.ok(data[field], `${rel} ${field}`);
        }
      }
      const payments = parse(files[".codex/agents/payments.toml"]);
      assert.match(payments.developer_instructions, /Triple quotes: """ end\./);
      assert.ok(Buffer.byteLength(files["AGENTS.md"]) < 8 * 1024, "AGENTS.md should stay small");
      for (const rel of Object.keys(files).filter((r) => r.endsWith("SKILL.md"))) {
        assert.match(files[rel], /^---\nname: [a-z-]+\ndescription: ".+"\n/);
      }
    });
  }
}

test("detects verification commands and fullstack repos", () => {
  const root = tmpdir();
  write(root, "package.json", JSON.stringify({ scripts: { test: "vitest", lint: "eslint ." }, dependencies: { react: "18" } }));
  write(root, "pnpm-lock.yaml", "");
  write(root, "pyproject.toml", "");
  write(root, "uv.lock", "");
  write(root, "contracts/openapi.yaml", "");
  write(root, "docs/STATUS.md", "");
  const d = detectProject(root);
  assert.deepEqual(d.verify, ["pnpm lint", "pnpm test", "uv run pytest"]);
  assert.deepEqual(d.sources, ["contracts/"]);
  assert.equal(d.preset, "web-fullstack");
  assert.equal(d.docs.status, "docs/STATUS.md");

  write(root, "scripts/check.sh", "");
  assert.deepEqual(detectProject(root).verify, ["bash scripts/check.sh"]);
});
