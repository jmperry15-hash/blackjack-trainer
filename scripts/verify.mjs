import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
mkdirSync(".build", { recursive: true });
await build({ entryPoints: ["scripts/verify.ts"], bundle: true, platform: "node", format: "esm", outfile: ".build/verify.mjs", logLevel: "warning" });
execFileSync("node", [".build/verify.mjs"], { stdio: "inherit" });
