import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { VERSION } from "./version.js";
import { PRESETS } from "./presets.js";
import { CONFIG_FILE, readConfig, ConfigError } from "./config.js";
import { detectProject, writeInitialConfig } from "./init.js";
import { sync } from "./sync.js";
import { runDoctor } from "./doctor.js";
import { DEFAULT_ALIASES, ALIASES_UPDATED } from "./models.js";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const red = c(31), yellow = c(33), cyan = c(36), dim = c(2), bold = c(1), green = c(32);

const HELP = `lean-agents ${VERSION}
Director-first agent setup for Claude Code and Codex.

Usage:
  lean-agents init [dir]     Create orchestration.toml (detects stack) and generate files
  lean-agents sync [dir]     Regenerate files from orchestration.toml
  lean-agents doctor [dir]   Lint any Claude Code / Codex agent setup (lean-agents or not)
  lean-agents presets        List presets and model aliases

Options (those with a value also accept --option=value):
  --target <tool>    init: claude | codex | both (default: detected, else both)
  --preset <name>     init: ${Object.keys(PRESETS).join(" | ")}
  --lang <es|en>      init: language of generated instructions (default: en)
  --name <name>       init: project name (default: folder name)
  -y, --yes           init: accept detected defaults without prompting
  --dry-run           init/sync: show the plan, write nothing
  --force             init/sync: overwrite files not created by lean-agents (keeps .bak)
  --json              doctor: machine-readable output
  --strict            doctor: exit 1 on warnings too
  -h, --help          Show help
  -v, --version       Show version
`;

const VALUE_OPTIONS = ["target", "preset", "lang", "name"];
const BOOLEAN_OPTIONS = ["yes", "help", "version", "dry-run", "force", "json", "strict"];

export function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-y" || a === "--yes") opts.yes = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "-v" || a === "--version") opts.version = true;
    else if (["--dry-run", "--force", "--json", "--strict"].includes(a)) opts[a.slice(2).replace("-r", "R")] = true;
    else if (a.startsWith("--") && VALUE_OPTIONS.includes(a.slice(2))) opts[a.slice(2)] = argv[++i];
    else if (a.startsWith("--") && a.includes("=")) {
      const eq = a.indexOf("=");
      const key = a.slice(2, eq);
      if (BOOLEAN_OPTIONS.includes(key)) throw new Error(`Option --${key} does not take a value`);
      if (!VALUE_OPTIONS.includes(key)) throw new Error(`Unknown option --${key}`);
      opts[key] = a.slice(eq + 1);
    } else if (a.startsWith("-")) throw new Error(`Unknown option ${a}`);
    else opts._.push(a);
  }
  return opts;
}

function printWarnings(warnings = []) {
  for (const w of warnings) console.error(yellow(`warning: ${CONFIG_FILE}: ${w}`));
}

function printActions(actions, root, dryRun) {
  const label = {
    create: green("create   "),
    update: cyan("update   "),
    overwrite: yellow("overwrite"),
    unchanged: dim("unchanged"),
    skip: yellow("skip     "),
    delete: red("delete   "),
    orphan: yellow("keep     "),
  };
  for (const a of actions) {
    const extra = a.reason ? dim(` (${a.reason})`) : a.backup ? dim(` (backup: ${path.relative(root, a.backup)})`) : "";
    console.log(`  ${label[a.type]} ${a.rel}${extra}`);
  }
  const skipped = actions.filter((a) => a.type === "skip");
  if (skipped.length) {
    console.log(yellow(`\n${skipped.length} file(s) skipped to protect existing content. Review them, then rerun with --force to replace (a .bak copy is kept).`));
  }
  if (dryRun) console.log(dim("\nDry run: nothing was written."));
}

async function ask(rl, question, fallback, choices) {
  const hint = choices ? ` (${choices.join("/")})` : "";
  for (;;) {
    const answer = (await rl.question(`${question}${hint} [${fallback}]: `)).trim() || fallback;
    if (!choices || choices.includes(answer)) return answer;
    console.log(yellow(`  Choose one of: ${choices.join(", ")}`));
  }
}

async function cmdInit(root, opts) {
  if (fs.existsSync(path.join(root, CONFIG_FILE))) {
    throw new Error(`${CONFIG_FILE} already exists. Edit it and run \`lean-agents sync\` instead.`);
  }
  const detected = detectProject(root);
  const targetChoice = (list) => (list.length === 2 ? "both" : list[0]);
  const parseTarget = (value) => {
    if (value === "both") return ["claude", "codex"];
    if (value === "claude" || value === "codex") return [value];
    throw new Error(`Unknown target "${value}". Use claude, codex or both.`);
  };
  const answers = {
    targets: opts.target ? parseTarget(opts.target) : detected.targets,
    name: opts.name ?? detected.name,
    language: opts.lang ?? "en",
    preset: opts.preset ?? detected.preset,
    verify: detected.verify,
    sources: detected.sources,
    docs: detected.docs,
  };
  if (!opts.yes && process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (!opts.target) {
        answers.targets = parseTarget(await ask(rl, "Which tool will use these agents?", targetChoice(answers.targets), ["claude", "codex", "both"]));
      }
      answers.name = await ask(rl, "Project name", answers.name);
      answers.language = await ask(rl, "Instruction language", answers.language, ["en", "es"]);
      for (const [k, p] of Object.entries(PRESETS)) console.log(dim(`  ${k}: ${p.description}`));
      answers.preset = await ask(rl, "Preset", answers.preset, Object.keys(PRESETS));
    } finally {
      rl.close();
    }
  }
  if (!PRESETS[answers.preset]) throw new Error(`Unknown preset "${answers.preset}".`);
  if (!["en", "es"].includes(answers.language)) throw new Error(`Unknown language "${answers.language}".`);

  console.log(bold(`\nDetected for ${answers.name}:`));
  console.log(`  tools:            ${answers.targets.map((t) => (t === "claude" ? "Claude Code" : "Codex")).join(" + ")}`);
  console.log(`  verify:           ${answers.verify.join(", ") || dim("(none found — add them to project.verify)")}`);
  console.log(`  sources of truth: ${answers.sources.join(", ") || dim("(none found)")}`);
  console.log(`  preset:           ${answers.preset}\n`);

  if (opts.dryRun) {
    console.log(`  ${green("create   ")} ${CONFIG_FILE}`);
    const { normalizeConfig } = await import("./config.js");
    const { parse } = await import("smol-toml");
    const { renderOrchestrationToml } = await import("./init.js");
    const cfg = normalizeConfig(parse(renderOrchestrationToml(answers)));
    printWarnings(cfg.warnings);
    printActions(sync(root, cfg, { dryRun: true, force: opts.force }), root, true);
    return 0;
  }
  writeInitialConfig(root, answers);
  console.log(`  ${green("create   ")} ${CONFIG_FILE}`);
  const cfg = readConfig(root);
  printWarnings(cfg.warnings);
  printActions(sync(root, cfg, { force: opts.force }), root, false);
  console.log(`\nNext: review ${CONFIG_FILE} (rules, verify, roles), run \`lean-agents sync\`, then \`lean-agents doctor\`.`);
  return 0;
}

function cmdSync(root, opts) {
  const cfg = readConfig(root);
  if (!cfg) throw new Error(`No ${CONFIG_FILE} in ${root}. Run \`lean-agents init\` first.`);
  printWarnings(cfg.warnings);
  printActions(sync(root, cfg, { force: opts.force, dryRun: opts.dryRun }), root, opts.dryRun);
  return 0;
}

function cmdDoctor(root, opts) {
  const { findings } = runDoctor(root);
  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const infos = findings.length - errors - warns;
  if (opts.json) {
    console.log(JSON.stringify({ version: VERSION, root, summary: { errors, warnings: warns, info: infos }, findings }, null, 2));
  } else {
    console.log(bold(`lean-agents doctor — ${root}\n`));
    const icon = { error: red("✖ error"), warn: yellow("▲ warn "), info: cyan("● info ") };
    for (const f of findings) {
      console.log(`${icon[f.severity]} ${bold(f.id)} ${dim(f.rule)}  ${f.file}`);
      console.log(`         ${f.message}`);
      if (f.fix) console.log(dim(`         fix: ${f.fix}`));
      console.log("");
    }
    if (!findings.length) console.log(green("No problems found.\n"));
    console.log(`${errors} error(s), ${warns} warning(s), ${infos} info.`);
  }
  return errors || (opts.strict && warns) ? 1 : 0;
}

function cmdPresets() {
  console.log(bold("Presets"));
  for (const [k, p] of Object.entries(PRESETS)) {
    console.log(`  ${k.padEnd(14)} ${p.description}`);
    console.log(dim(`  ${"".padEnd(14)} roles: ${p.roles.join(", ")} · skills: ${p.skills.join(", ")}`));
  }
  console.log(bold(`\nModel aliases (updated ${ALIASES_UPDATED}; override in [models.aliases.<tool>])`));
  console.log(dim(`  ${"alias".padEnd(14)} ${"claude".padEnd(14)} codex`));
  for (const k of Object.keys(DEFAULT_ALIASES.claude)) {
    console.log(`  ${k.padEnd(14)} ${DEFAULT_ALIASES.claude[k].padEnd(14)} ${DEFAULT_ALIASES.codex[k]}`);
  }
  return 0;
}

export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(red(err.message));
    return 2;
  }
  if (opts.version) {
    console.log(VERSION);
    return 0;
  }
  const [command, dir = "."] = opts._;
  if (opts.help || !command) {
    console.log(HELP);
    return command || opts.help ? 0 : 2;
  }
  const root = path.resolve(dir);
  try {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
    switch (command) {
      case "init":
        return await cmdInit(root, opts);
      case "sync":
        return cmdSync(root, opts);
      case "doctor":
        return cmdDoctor(root, opts);
      case "presets":
        return cmdPresets();
      default:
        console.error(red(`Unknown command "${command}".\n`));
        console.log(HELP);
        return 2;
    }
  } catch (err) {
    printWarnings(err.warnings);
    console.error(red(err instanceof ConfigError ? err.message : `Error: ${err.message}`));
    return 1;
  }
}
