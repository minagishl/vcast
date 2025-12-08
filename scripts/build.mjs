#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "esbuild";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const log = (msg) => console.log(msg);

async function runTsc() {
  log("Running tsc...");
  await execFileAsync("bun", ["run", "tsc"], { cwd: rootDir });
}

async function findJsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return findJsFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith(".js")) return [fullPath];
      return [];
    })
  );
  return files.flat();
}

async function minifyDist() {
  const files = await findJsFiles(distDir);
  await Promise.all(
    files.map(async (file) => {
      await build({
        entryPoints: [file],
        outfile: file,
        platform: "node",
        format: "esm",
        target: "node20",
        bundle: false,
        minify: true,
        sourcemap: true,
        sourcesContent: false,
        allowOverwrite: true,
        logLevel: "silent",
      });
    })
  );
}

async function addShebang() {
  log("Adding shebang to dist/index.js...");
  const indexFile = path.join(distDir, "index.js");
  const content = await fs.readFile(indexFile, "utf-8");

  if (!content.startsWith("#!")) {
    const withShebang = "#!/usr/bin/env bun\n" + content;
    await fs.writeFile(indexFile, withShebang);
    await fs.chmod(indexFile, 0o755);
    log("Shebang added to dist/index.js");
  }
}

async function buildVite() {
  log("Building frontend with Vite...");
  await execFileAsync("bun", ["run", "vite", "build"], { cwd: rootDir });
}

async function main() {
  await runTsc();
  await minifyDist();
  await addShebang();
  await buildVite();
  log("Build complete.");
}

main().catch((err) => {
  console.error("Build failed:", err.message || err);
  process.exit(1);
});
