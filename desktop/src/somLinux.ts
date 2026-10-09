// Linux: o venmic (o mesmo do Vesktop) cria no PipeWire um microfone virtual, "vencord-screen-share",
// e liga nele só o programa escolhido. O site abre esse microfone e junta com a tela (preload.ts)
import { app } from "electron";
import type { EscolhaAudio, Programa } from "./canais";

type Venmic = typeof import("@vencord/venmic");
type No = Record<string, string>;

let venmic: InstanceType<Venmic["PatchBay"]> | null | undefined;

function patchBay() {
    if (venmic !== undefined) return venmic;
    venmic = null;
    try {
        // fica fora do bundle (é binário nativo) e só existe no Linux
        const { PatchBay } = require("@vencord/venmic") as Venmic;
        if (PatchBay.hasPipeWire()) venmic = new PatchBay();
        else console.warn("[audio] sem PipeWire: a tela vai sem som");
    } catch (err) {
        console.error("[audio] não deu pra carregar o venmic", err);
    }
    return venmic;
}

// o processo que toca o som do Liberdade (as vozes da chamada)
function nosDoApp(): No[] {
    const pid = app.getAppMetrics().find((p) => p.name === "Audio Service")?.pid;
    return [{ "application.name": app.getName() }, ...(pid ? [{ "application.process.id": String(pid) }] : [])];
}
const ehDoApp = (no: No) => nosDoApp().some((n) => Object.entries(n).every(([k, v]) => no[k] === v));

export const somLinux = {
    modo: "virtual" as const,
    podeTudo: true,
    rotulo: "Programas tocando agora",
    disponivel: () => patchBay() !== null,

    // programas tocando som agora (cada um pode ter várias saídas: aparece uma vez)
    async listar(): Promise<Programa[]> {
        const nomes = new Set<string>();
        for (const no of patchBay()?.list() ?? []) {
            if (no["media.class"] !== "Stream/Output/Audio" || ehDoApp(no)) continue;
            const nome = no["application.name"] || no["node.name"];
            if (nome) nomes.add(nome);
        }
        return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")).map((nome) => ({ id: nome, nome }));
    },

    ligar(escolha: EscolhaAudio) {
        const pb = patchBay();
        if (!pb || escolha.tipo === "nenhum") return false;
        // microfones e outras gravações não entram, nem o som do Liberdade
        const exclude: No[] = [...nosDoApp(), { "media.class": "Stream/Input/Audio" }];
        const include: No[] = escolha.tipo === "programa" ? [{ "application.name": escolha.id }] : [];
        try {
            return pb.link({ include, exclude, ignore_devices: true, only_speakers: false, mute: false });
        } catch (err) {
            console.error("[audio] não deu pra ligar o microfone virtual", err);
            return false;
        }
    },

    parar() {
        try {
            patchBay()?.unlink();
        } catch (err) {
            console.error("[audio] não deu pra desligar o microfone virtual", err);
        }
    },
};
