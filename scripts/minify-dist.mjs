import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { minify } from "terser";

const dist = path.resolve("dist");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const files = await walk(dist);
for (const file of files) {
  if (file.endsWith(".map")) {
    await unlink(file);
    continue;
  }
  if (!file.endsWith(".js")) continue;

  const source = await readFile(file, "utf8");
  const result = await minify(source, {
    compress: { passes: 2 },
    mangle: { toplevel: false },
    format: { comments: false },
    sourceMap: false,
  });
  if (typeof result.code !== "string" || result.code.length === 0) {
    throw new Error(`terser produced empty output for ${file}`);
  }
  await writeFile(file, result.code);
}
