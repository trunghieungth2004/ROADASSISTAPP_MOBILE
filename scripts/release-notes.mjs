#!/usr/bin/env node
import {readFileSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";

const args = process.argv.slice(2);
const positional = args.filter((arg) => !arg.startsWith("--"));
const tag = positional[0];
const check = args.includes("--check");
const outputArg = positional[1];

if (!tag) {
  console.error("Usage: node scripts/release-notes.mjs <tag> [output] [--check]");
  console.error("Example: node scripts/release-notes.mjs v0.2.0 release-notes.md");
  process.exit(1);
}

const version = tag.replace(/^v/i, "");
const changelogPath = resolve("CHANGELOG.md");
const lines = readFileSync(changelogPath, "utf8").split(/\r?\n/);
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const heading = new RegExp(`^##\\s+\\[?v?${escaped}\\]?(?:\\s|$)`);
const start = lines.findIndex((line) => heading.test(line));

if (start === -1) {
  const available = lines
    .filter((line) => /^##\s+\[/.test(line))
    .map((line) => line.replace(/^##\s+\[([^\]]+)\].*$/, "$1"))
    .join(", ");
  console.error(`No CHANGELOG.md section for ${version}.`);
  console.error(`Available sections: ${available || "none"}`);
  process.exit(1);
}

const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
const section = lines
  .slice(start + 1, end === -1 ? undefined : end)
  .join("\n")
  .trim();

if (section === "") {
  console.error(`The CHANGELOG.md section for ${version} is empty.`);
  process.exit(1);
}

const body = [
  section,
  "",
  "---",
  "",
  `**Install:** download \`roadassist-${tag}.apk\` below. Android may ask you to allow installs from this source.`,
  "",
].join("\n");

if (check) {
  console.log(`Release notes OK for ${tag} (${section.length} characters).`);
  process.exit(0);
}

if (outputArg) {
  const outputPath = resolve(outputArg);
  writeFileSync(outputPath, body);
  console.log(`Wrote ${outputPath}`);
} else {
  process.stdout.write(body);
}
