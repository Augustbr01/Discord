// abre o app em desenvolvimento. O terminal do VSCode (que é Electron) deixa ELECTRON_RUN_AS_NODE=1
// no ambiente, e com ela o Electron roda como Node puro e o app quebra logo na primeira linha
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const electron = createRequire(import.meta.url)("electron");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

spawn(electron, [".", ...process.argv.slice(2)], { stdio: "inherit", env }).on("exit", (codigo) => process.exit(codigo ?? 0));
