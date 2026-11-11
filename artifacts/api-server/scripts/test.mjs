import { build } from "esbuild";
import { readdir, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

// Bundle TS tests only; leave packages external and generated files out of Git.
const outdir = resolve("../../generated-artifacts/render-regression/tests");
await mkdir(outdir, { recursive: true });
const all = (await readdir("src/lib")).filter(f => f.endsWith(".test.ts"));
const entries = all.filter(f => process.argv.includes("--render") ? f.startsWith("render-regression.") : !f.startsWith("render-regression."));
if (!entries.length) throw new Error("No test entry points found");
await build({ entryPoints: entries.map(f => `src/lib/${f}`), outdir, bundle: true,
  platform: "node", format: "esm", packages: "external", outExtension: { ".js": ".mjs" } });
// Keep output under the package for Node's external dependency resolution.
// NODE_PATH is not used by ESM; resolve package imports from this package via symlink.
const { symlink, lstat } = await import("node:fs/promises");
const link = resolve(outdir, "../node_modules");
try { await lstat(link); } catch { await symlink(resolve("node_modules"), link, "dir"); }
const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...entries.map(f => resolve(outdir, f.replace(/\.ts$/, ".mjs")))], { stdio: "inherit" });
process.exit(result.status ?? 1);
