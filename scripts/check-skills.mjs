/**
 * Every installed skill is valid, and nothing executable came with it.
 *
 * Two failures this catches. A SKILL.md whose frontmatter is malformed or whose
 * `name` breaks the rules never loads — it sits in the directory looking
 * installed and does nothing, which is worse than not having it. And a skill
 * runs with the same tool access as everything else in this repository, which
 * holds a database URL: an executable arriving inside a skill directory is the
 * thing to notice before it runs, not after.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../.claude/skills");
const problems = [];
let count = 0;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(root, entry.name);
  count += 1;

  // Nothing but markdown. The installer strips executables; this proves it.
  for (const file of walk(dir)) {
    if (!/\.md$/i.test(file)) problems.push(`${entry.name}: non-markdown file ${file.slice(root.length + 1)}`);
  }

  const skillFile = join(dir, "SKILL.md");
  let source;
  try {
    source = readFileSync(skillFile, "utf8");
  } catch {
    problems.push(`${entry.name}: no SKILL.md — the directory will never load`);
    continue;
  }

  const front = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!front) { problems.push(`${entry.name}: no YAML frontmatter`); continue; }

  const field = (key) => {
    const m = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(front[1]);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  };

  const name = field("name");
  const description = field("description");

  if (!name) problems.push(`${entry.name}: frontmatter has no name`);
  else {
    if (name.length > 64) problems.push(`${entry.name}: name is ${name.length} chars, max 64`);
    if (!/^[a-z0-9-]+$/.test(name)) problems.push(`${entry.name}: name "${name}" must be lowercase letters, numbers and hyphens`);
    if (/anthropic|claude/i.test(name)) problems.push(`${entry.name}: name contains a reserved word`);
    if (name !== entry.name) problems.push(`${entry.name}: declares name "${name}" — the directory should match`);
  }
  if (!description) problems.push(`${entry.name}: frontmatter has no description`);
  else if (description.length > 1024) problems.push(`${entry.name}: description is ${description.length} chars, max 1024`);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s) in ${count} skill(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`${count} skills installed, all valid, markdown only.`);
