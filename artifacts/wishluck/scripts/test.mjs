import {build} from "esbuild";
import {mkdir, readdir, lstat, symlink} from "node:fs/promises";
import {resolve} from "node:path";
import {createRequire} from "node:module";
import {spawnSync} from "node:child_process";

// Build the real component and local imports; keep installed packages external.
// Generated output is ignored and never becomes part of the deployed app.
const outdir = resolve("../../generated-artifacts/publishing-ui/tests");
const entries = (await readdir("tests")).filter(f => /\.test\.tsx?$/.test(f));
if (!entries.length) throw new Error("No publishing UI tests found");
await mkdir(outdir, {recursive: true});
await build({
  entryPoints: {
    dom: "tests/helpers/dom.ts",
    ...Object.fromEntries(entries.map(f => [f.replace(/\.tsx?$/, ""), `tests/${f}`])),
  }, outdir, bundle: true,
  platform: "node", format: "esm", packages: "external", jsx: "automatic",
  tsconfig: "tsconfig.json", outExtension: {".js": ".mjs"},
});
const link = resolve(outdir, "../node_modules");
try { await lstat(link); } catch { await symlink(resolve("node_modules"), link, "dir"); }
const workspaceRequire = createRequire(resolve("../../scripts/package.json"));
const result = spawnSync(process.execPath, [
  "--import", workspaceRequire.resolve("tsx/esm"),
  "--import", resolve(outdir, "dom.mjs"),
  "--test", "--test-concurrency=1",
  ...entries.map(f => resolve(outdir, f.replace(/\.tsx?$/, ".mjs"))),
], {stdio: "inherit"});
process.exit(result.status ?? 1);
