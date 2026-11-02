// Tiny TOML writers so generated files stay readable (comments, multiline strings).

export function str(value) {
  return JSON.stringify(String(value)); // JSON string escapes are valid TOML basic strings
}

export function multiline(value) {
  const body = String(value).replace(/\\/g, "\\\\").replace(/"""/g, '""\\"');
  return `"""\n${body}\n"""`;
}
