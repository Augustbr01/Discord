// compila o main e os preloads (TypeScript → dist/*.js) e copia as páginas locais
import { build } from "esbuild";
import { cpSync, readdirSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });

await build({
    entryPoints: ["src/main.ts", "src/preload.ts", "src/preloadSeletor.ts"],
    outdir: "dist",
    bundle: true,
    platform: "node",
    // preload com sandbox precisa ser CommonJS
    format: "cjs",
    target: "node22",
    external: ["electron"],
    sourcemap: true,
    logLevel: "info",
});

for (const arquivo of readdirSync("src").filter((a) => a.endsWith(".html"))) {
    cpSync(`src/${arquivo}`, `dist/${arquivo}`);
}
