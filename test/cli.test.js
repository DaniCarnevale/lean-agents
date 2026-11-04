import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

test("init writes a config with no unknown keys", () => {
  const root = tmpdir();
  const r = run("init", root, "-y", "--target=claude", "--name=a=b");
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.stderr, /does not exist/);
  assert.equal(readConfig(root).project.name, "a=b");
});
