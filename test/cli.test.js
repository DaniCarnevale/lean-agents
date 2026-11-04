import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../src/cli.js";
import { sync } from "../src/sync.js";
import { writeInitialConfig } from "../src/init.js";
import { readConfig } from "../src/config.js";
import { tmpdir, write, read, baseAnswers } from "./helpers.js";

const BIN = fileURLToPath(new URL("../bin/lean-agents.js", import.meta.url));
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });

test("parseArgs reads flags, options with a separate value and positionals", () => {
  assert.deepEqual(parseArgs(["init", "app", "--target", "claude", "-y", "--dry-run"]), {
    _: ["init", "app"],
    target: "claude",
    yes: true,
    dryRun: true,
  });
});

test("parseArgs accepts --key=value for every known option", () => {
  assert.deepEqual(parseArgs(["--target=codex", "--preset=minimal", "--lang=es", "--name=demo"]), {
    _: [],
    target: "codex",
    preset: "minimal",
    lang: "es",
    name: "demo",
  });
});

test("parseArgs splits only on the first =", () => {
  assert.equal(parseArgs(["--name=a=b=c"]).name, "a=b=c");
});

test("parseArgs rejects unknown options, with or without a value", () => {
  assert.throws(() => parseArgs(["--foo=bar"]), /Unknown option --foo/);
  assert.throws(() => parseArgs(["--foo"]), /Unknown option --foo/);
  assert.throws(() => parseArgs(["-x"]), /Unknown option -x/);
  assert.throws(() => parseArgs(["--=x"]), /Unknown option/);
});

for (const flag of ["force", "dry-run", "json", "strict", "yes", "help", "version"]) {
  test(`parseArgs rejects a value on the boolean flag --${flag}`, () => {
    assert.throws(() => parseArgs([`--${flag}=true`]), new RegExp(`--${flag} does not take a value`));
  });
}

test("parseArgs keeps positionals that contain =", () => {
  assert.deepEqual(parseArgs(["a=b"])._, ["a=b"]);
});

for (const arg of ["--foo=bar", "--force=true", "-x"]) {
  test(`the CLI exits with code 2 on ${arg}`, () => {
    const r = run("doctor", arg);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /option/i);
  });
}

function projectWithTypo() {
  const root = tmpdir();
  writeInitialConfig(root, baseAnswers());
  write(root, "orchestration.toml", read(root, "orchestration.toml").replace("max_threads = 2", 'max_threads = 2\ndelegaton = "explicit"'));
  return root;
}

test("sync prints unknown keys as warnings and still succeeds", () => {
  const root = projectWithTypo();
  const r = run("sync", root);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /`delegaton` does not exist, did you mean `delegation`\?/);
});

test("doctor fails on unknown keys only with --strict", () => {
  const root = projectWithTypo();
  sync(root, readConfig(root));
  assert.equal(run("doctor", root).status, 0);
  const strict = run("doctor", root, "--strict");
  assert.equal(strict.status, 1);
  assert.match(strict.stdout, /LA003/);
});

// Runs `init` as if on a terminal, sending each answer when its prompt appears.
function initInteractive(args, answers) {
  const script = `
    import { main } from ${JSON.stringify(new URL("../src/cli.js", import.meta.url).href)};
    process.stdin.isTTY = true;
    process.exitCode = await main(${JSON.stringify(["init", ...args])});
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script]);
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`init did not finish. Output so far:\n${stdout}`));
    }, 20000);
    let stdout = "";
    let sent = 0;
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
      const prompts = stdout.split("]: ").length - 1;
      while (sent < prompts) child.stdin.write(`${answers[sent++] ?? ""}\n`);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout });
    });
  });
}

test("interactive init asks each question and uses the answers", async () => {
  const root = tmpdir();
  const r = await initInteractive([root], ["codex", "demo-app", "es", "minimal"]);
  assert.equal(r.code, 0, r.stdout);
  const cfg = readConfig(root);
  assert.deepEqual(cfg.targets, ["codex"]);
  assert.equal(cfg.project.name, "demo-app");
  assert.equal(cfg.language, "es");
  assert.equal(cfg.preset, "minimal");
});

test("interactive init asks again after an invalid choice and accepts defaults", async () => {
  const root = tmpdir();
  const r = await initInteractive([root], ["cursor", "claude", "", "", ""]);
  assert.equal(r.code, 0, r.stdout);
  assert.match(r.stdout, /Choose one of: claude, codex, both/);
  const cfg = readConfig(root);
  assert.deepEqual(cfg.targets, ["claude"]);
  assert.equal(cfg.language, "en");
  assert.equal(cfg.preset, "standard");
});

test("interactive init does not ask for the tool when --target is given", async () => {
  const root = tmpdir();
  const r = await initInteractive([root, "--target=claude"], ["", "", ""]);
  assert.equal(r.code, 0, r.stdout);
  assert.doesNotMatch(r.stdout, /Which tool/);
  assert.deepEqual(readConfig(root).targets, ["claude"]);
});

test("init writes a config with no unknown keys", () => {
  const root = tmpdir();
  const r = run("init", root, "-y", "--target=claude", "--name=a=b");
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stderr, /does not exist/);
  assert.equal(readConfig(root).project.name, "a=b");
});
