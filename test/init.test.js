import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { detectProject } from "../src/init.js";
import { tmpdir, write } from "./helpers.js";

const pkg = (fields) => JSON.stringify(fields);
const member = (root, dir, dep) => write(root, `${dir}/package.json`, pkg({ dependencies: { [dep]: "1" } }));

test("a Makefile with a check target wins over ecosystem detection", () => {
  for (const target of ["check:", "check: lint test", "check :", "check::"]) {
    const root = tmpdir();
    write(root, "Makefile", `.PHONY: check\n\n${target}\n\tnpm test\n`);
    write(root, "package.json", pkg({ scripts: { test: "x" } }));
    assert.deepEqual(detectProject(root).verify, ["make check"], target);
  }
});

test("a Makefile with CRLF line endings still has a check target", () => {
  const root = tmpdir();
  write(root, "Makefile", "build:\r\n\techo\r\ncheck:\r\n\techo\r\n");
  assert.deepEqual(detectProject(root).verify, ["make check"]);
});

test("a Makefile without a check target does not block detection", () => {
  const root = tmpdir();
  write(root, "Makefile", ".PHONY: check-all\nbuild:\n\techo\ncheck-all:\n\techo\n  check:\n");
  write(root, "package.json", pkg({ scripts: { test: "x" } }));
  write(root, "pyproject.toml", "");
  assert.deepEqual(detectProject(root).verify, ["npm test", "pytest"]);
});

test("a Makefile folder does not fail detection", () => {
  const root = tmpdir();
  write(root, "Makefile/keep.txt", "");
  assert.deepEqual(detectProject(root).verify, []);
});

test("check scripts still take priority over a Makefile", () => {
  const root = tmpdir();
  write(root, "Makefile", "check:\n\techo\n");
  write(root, "scripts/check.sh", "");
  assert.deepEqual(detectProject(root).verify, ["bash scripts/check.sh"]);
});

for (const [shape, workspaces] of [
  ["an array", ["apps/*", "services/api"]],
  ["an object", { packages: ["apps/*", "services/api"] }],
]) {
  test(`package.json workspaces as ${shape}: detects frontend and backend`, () => {
    const root = tmpdir();
    write(root, "package.json", pkg({ workspaces }));
    member(root, "apps/web", "react");
    member(root, "services/api", "fastify");
    assert.equal(detectProject(root).preset, "web-fullstack");
  });
}

test("workspace packages use the same dependency lists as the root", () => {
  for (const frontend of ["@angular/core", "solid-js"]) {
    for (const backend of ["koa", "@nestjs/core"]) {
      const root = tmpdir();
      write(root, "package.json", pkg({ workspaces: ["a", "b"] }));
      member(root, "a", frontend);
      write(root, "b/package.json", pkg({ devDependencies: { [backend]: "1" } }));
      assert.equal(detectProject(root).preset, "web-fullstack", `${frontend} + ${backend}`);
    }
  }
});

test("a workspace package can combine with dependencies in the root", () => {
  const root = tmpdir();
  write(root, "package.json", pkg({ workspaces: ["web"], dependencies: { express: "1" } }));
  member(root, "web", "vue");
  assert.equal(detectProject(root).preset, "web-fullstack");
});

test("normalizes ./ prefixes and trailing slashes", () => {
  const root = tmpdir();
  write(root, "package.json", pkg({ workspaces: ["./web/", "./svc/*/"] }));
  member(root, "web", "react");
  member(root, "svc/api", "hono");
  assert.equal(detectProject(root).preset, "web-fullstack");
});

test("complex or unusable patterns are ignored without failing", () => {
  const parent = tmpdir();
  const root = path.join(parent, "repo");
  const workspaces = ["apps/**", "{a,b}/*", "apps/*/sub", "*", "!apps/web", "missing/*", "missing", "../outside", "..\\outside", "/abs", 42, null, ""];
  write(root, "package.json", pkg({ workspaces }));
  member(root, "apps/web", "react");
  member(root, "a/api", "express");
  write(parent, "outside/package.json", pkg({ dependencies: { express: "1" } }));
  assert.equal(detectProject(root).preset, "standard");
});

test("malformed workspace fields and packages do not fail", () => {
  for (const workspaces of ["apps/*", 1, null, {}, { packages: "apps/*" }, { nohoist: ["x"] }]) {
    const root = tmpdir();
    write(root, "package.json", pkg({ workspaces }));
    write(root, "apps/web/package.json", "{ not json");
    assert.equal(detectProject(root).preset, "standard");
  }
});

test("non-directory entries in a wildcard folder are skipped", () => {
  const root = tmpdir();
  write(root, "package.json", pkg({ workspaces: ["apps/*"] }));
  write(root, "apps/README.md", "x");
  member(root, "apps/web", "react");
  member(root, "apps/api", "express");
  assert.equal(detectProject(root).preset, "web-fullstack");
});

test("pnpm-workspace.yaml: reads a block list outside apps/ and packages/", () => {
  const root = tmpdir();
  write(root, "pnpm-workspace.yaml", "# comment\ncatalog:\n  react: 18\npackages:\r\n  # frontend\n  - 'web/*' # all\n  - \"svc/api\"\n  - '!web/legacy'\nonlyBuiltDependencies:\n  - other/*\n");
  member(root, "web/site", "react");
  member(root, "svc/api", "express");
  assert.equal(detectProject(root).preset, "web-fullstack");
});

test("pnpm-workspace.yaml: stops the list at the next key", () => {
  const root = tmpdir();
  write(root, "pnpm-workspace.yaml", "packages:\n  - web\nother:\n  - svc\n");
  member(root, "web", "react");
  member(root, "svc", "express");
  assert.equal(detectProject(root).preset, "standard");
});

test("pnpm-workspace.yaml: an inline list falls back to apps/ and packages/", () => {
  const root = tmpdir();
  write(root, "pnpm-workspace.yaml", "packages: ['web', svc/*]\n");
  member(root, "web", "react");
  member(root, "svc/api", "express");
  assert.equal(detectProject(root).preset, "standard");
  member(root, "apps/web", "react");
  member(root, "packages/api", "express");
  assert.equal(detectProject(root).preset, "web-fullstack");
});

test("pnpm-workspace.yaml without packages keeps looking in apps/ and packages/", () => {
  const root = tmpdir();
  write(root, "pnpm-workspace.yaml", "catalog:\n  react: 18\n");
  member(root, "apps/web", "next");
  member(root, "packages/api", "express");
  assert.equal(detectProject(root).preset, "web-fullstack");
});

test("workspaces are not read unless declared", () => {
  const root = tmpdir();
  write(root, "package.json", pkg({}));
  member(root, "apps/web", "react");
  member(root, "apps/api", "express");
  assert.equal(detectProject(root).preset, "standard");
});
