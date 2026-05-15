import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import Mustache from "mustache";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

const md = await readFile(resolve(root, "content.md"), "utf8");
const tpl = await readFile(resolve(root, "index.template.html"), "utf8");

const { data, content } = matter(md);

// Body is split on `## section_name` headings; each section is rendered to HTML
// and exposed as a top-level key for Mustache (e.g. `## about_p1` -> `{{{about_p1}}}`).
const bodySections = {};
const blocks = content.split(/^##\s+/m).map(b => b.trim()).filter(Boolean);
for (const block of blocks) {
  const newline = block.indexOf("\n");
  const name = block.slice(0, newline).trim();
  const body = block.slice(newline + 1).trim();
  bodySections[name] = marked.parseInline(body);
}

const view = { ...data, ...bodySections };

// Marquee items render twice in source for a seamless scroll loop.
if (Array.isArray(data.marquee)) {
  view.marquee_doubled = [...data.marquee, ...data.marquee];
}

const html = Mustache.render(tpl, view);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await writeFile(resolve(dist, "index.html"), html);

for (const file of ["colors_and_type.css", "styles.css", "CNAME"]) {
  await cp(resolve(root, file), resolve(dist, file));
}
await cp(resolve(root, "assets"), resolve(dist, "assets"), { recursive: true });

console.log("Built dist/index.html");
