import { roomService } from "./config/RoomService";
import { buscarServidor } from "./config/CacheTyping";
import { entrouNaCall, participantesDaCall, saiuDaCall } from "./eventosCall";
import { publicarParaServidor } from "./routes/eventosConexao";
import { estadoYoutube, limparYoutube } from "./youtube";
import { estadoSala, limparSala } from "./controleSala";

// Quem está em cada call vem dos webhooks do LiveKit, mas eles podem não chegar (ex.: o LiveKit
// não alcança o servidor) e a lista some quando o servidor reinicia. Então, de tempos em tempos,
// confere com o próprio LiveKit e avisa as diferenças (entrou/saiu) como se fosse o webhook
const INTERVALO_MS = 10_000;

// a call do hall do mundo 3D (hall-<servidorId>) não é um canal: fica fora disso
export const ehSalaDoHall = (nome: string) => nome.startsWith("hall-");

async function conferir() {
    const salas = await roomService.listRooms();
    const noLiveKit = new Map<string, string[]>();
    for (const sala of salas) {
        if (ehSalaDoHall(sala.name)) continue;
        const pessoas = sala.numParticipants > 0 ? await roomService.listParticipants(sala.name) : [];
        noLiveKit.set(sala.name, pessoas.map((p) => p.identity));
    }

    // salas que a gente acha que têm gente, mas o LiveKit nem tem mais (ninguém nelas)
    const canais = new Set([...noLiveKit.keys(), ...participantesNaMemoria()]);
    for (const canalId of canais) {
        const agora = noLiveKit.get(canalId) ?? [];
        const antes = participantesDaCall(canalId);
        const entraram = agora.filter((id) => !antes.includes(id));
        const sairam = antes.filter((id) => !agora.includes(id));
        if (entraram.length === 0 && sairam.length === 0) continue;

        const servidorId = await buscarServidor(canalId);
        if (!servidorId) continue;

        for (const usuarioId of entraram) {
            entrouNaCall(canalId, usuarioId);
            await publicarParaServidor(servidorId, { tipo: "ENTROU_NA_CALL", canalId, usuarioId });
        }
        for (const usuarioId of sairam) {
            saiuDaCall(canalId, usuarioId);
            await publicarParaServidor(servidorId, { tipo: "SAIU_DA_CALL", canalId, usuarioId });
        }
        // esvaziou: o YouTube e o controle da sala vão embora junto (igual ao webhook)
        if (participantesDaCall(canalId).length === 0) {
            if (limparYoutube(canalId)) await publicarParaServidor(servidorId, { tipo: "YT_ESTADO", agora: Date.now(), estado: estadoYoutube(canalId) });
            if (limparSala(canalId)) await publicarParaServidor(servidorId, { tipo: "SALA_ESTADO", estado: estadoSala(canalId) });
        }
    }
}

let memoria: () => string[] = () => [];
const participantesNaMemoria = () => memoria();

export function iniciarSincronizacaoCalls(canaisComGente: () => string[]) {
    memoria = canaisComGente;
    const rodar = () => conferir().catch((e) => console.log("conferir calls com o LiveKit falhou:", e?.message ?? e));
    rodar();
    setInterval(rodar, INTERVALO_MS);
}
