// Windows: o Chromium só captura o som do computador inteiro (com as vozes da chamada junto: os
// outros se ouviriam de volta). O ApplicationLoopback.exe (vendor/application-loopback) captura só
// um processo, pela API de loopback por processo do Windows 10 2004+, e escreve o PCM na saída
// padrão; daqui ele vai pro site pelo IPC (preload.ts monta a faixa de som)
import { app, type WebContents } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { CANAIS, type EscolhaAudio, type Programa } from "./canais";

// no pacote vem em resources/ (extraResources: não pode estar dentro do .asar pra rodar)
const pasta = () => app.isPackaged
    ? path.join(process.resourcesPath, "application-loopback")
    : path.join(__dirname, "..", "vendor", "application-loopback");

// 2 canais × 16 bits: o PCM só pode ser cortado em múltiplos de 4 bytes
const BYTES_POR_QUADRO = 4;

let captura: ChildProcess | null = null;

// janelas visíveis: "pid;hwnd;título" por linha. As do próprio Liberdade ficam de fora
function listarJanelas() {
    return new Promise<Programa[]>((resolver) => {
        let saida = "";
        const lista = spawn(path.join(pasta(), "ProcessList.exe"), { windowsHide: true });
        lista.stdout.setEncoding("utf8");
        lista.stdout.on("data", (parte: string) => {
            saida += parte;
        });
        lista.on("error", (err) => {
            console.error("[audio] não deu pra listar as janelas", err);
            resolver([]);
        });
        lista.on("close", () => {
            const vistos = new Map<string, Programa>();
            for (const linha of saida.split(/\r?\n/)) {
                const [pid, , ...titulo] = linha.split(";");
                const nome = titulo.join(";").trim();
                if (!pid || !nome || Number(pid) === process.pid || vistos.has(pid)) continue;
                vistos.set(pid, { id: pid, nome });
            }
            resolver([...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
        });
    });
}

export const somWindows = {
    modo: "pcm" as const,
    // o auxiliar só sabe incluir um processo, não "todos menos o Liberdade"
    podeTudo: false,
    rotulo: "Janelas abertas",
    disponivel: () => true,
    listar: listarJanelas,

    ligar(escolha: EscolhaAudio, destino: WebContents) {
        if (escolha.tipo !== "programa") return false;
        somWindows.parar();
        const filho = spawn(path.join(pasta(), "ApplicationLoopback.exe"), [escolha.id], { windowsHide: true });
        captura = filho;
        let resto: Buffer = Buffer.alloc(0);
        filho.stdout.on("data", (parte: Buffer) => {
            const dados = resto.length ? Buffer.concat([resto, parte]) : parte;
            const inteiro = dados.length - (dados.length % BYTES_POR_QUADRO);
            resto = dados.subarray(inteiro);
            if (inteiro > 0 && !destino.isDestroyed()) destino.send(CANAIS.pcm, dados.subarray(0, inteiro));
        });
        filho.on("error", (err) => console.error("[audio] não deu pra capturar o som da janela", err));
        filho.on("exit", (codigo) => {
            if (captura === filho) captura = null;
            if (codigo) console.warn(`[audio] a captura parou (código ${codigo})`);
        });
        return true;
    },

    parar() {
        captura?.kill();
        captura = null;
    },
};
