import {expect, test} from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import {en} from "../../src/i18n/en";
import {vi} from "../../src/i18n/vi";

function leafPaths(value: unknown, prefix = ""): string[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

test("en and vi define exactly the same keys", () => {
  const enKeys = leafPaths(en).sort();
  const viKeys = leafPaths(vi).sort();
  expect(viKeys).toEqual(enKeys);
});

test("every static t.* read resolves in en", () => {
  const leaves = new Set(leafPaths(en));
  const roots = new Set(leafPaths(en).map((k) => k.split(".")[0]));
  const srcDir = path.resolve(__dirname, "../../src");
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  walk(srcDir);
  const missing: string[] = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const re = /\bt\.([A-Za-z][\w]*(?:\.[A-Za-z][\w]*)*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      let key = m[1];
      const after = text.slice(m.index + m[0].length);
      while (/^\(/.test(after) && key.includes(".")) {
        key = key.split(".").slice(0, -1).join(".");
      }
      const top = key.split(".")[0];
      if (!roots.has(top)) continue;
      if (leaves.has(key)) continue;
      const isPrefix = [...leaves].some((leaf) => leaf.startsWith(`${key}.`));
      if (!isPrefix && !missing.includes(`${path.relative(srcDir, file)}: t.${key}`)) {
        missing.push(`${path.relative(srcDir, file)}: t.${key}`);
      }
    }
  }
  expect(missing).toEqual([]);
});
