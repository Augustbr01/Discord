import { ParticipantInfo_State, TrackSource } from "livekit-server-sdk";
import { roomService } from "./config/RoomService";
import { buscarServidor } from "./config/CacheTyping";
import { devolverTempoCall, entrouNaCall, mudarTela, participantesDaCall, saiuDaCall, telasDaCall } from "./eventosCall";
import { statusTela } from "./interface/Evento";
import { publicarParaServidor } from "./routes/eventosConexao";
import { estadoYoutube, limparYoutube } from "./youtube";
import { estadoSala, limparSala } from "./controleSala";

// Quem está em cada call (e quem compartilha a tela) é sempre uma FOTO tirada do próprio LiveKit,
// nunca a soma dos webhooks: eles não têm entrega garantida, podem chegar fora de ordem entre
// salas, e quando a mesma pessoa reconecta na mesma sala chega o "saiu" da sessão velha — somando
// os eventos, a pessoa sumia da placa da porta estando lá dentro.
//
// - cada webhook de uma sala agenda uma leitura dela (vários em sequência viram uma leitura só);
// - de tempos em tempos confere todas (pega o que nenhum webhook avisou, e o servidor reiniciado).
// Em cada leitura, só as diferenças viram aviso pros clientes (ENTROU/SAIU/TELA).
const INTERVALO_MS = 10_000;
const ESPERA_WEBHOOK_MS = 150;
// uma segunda leitura depois do webhook: logo após um "saiu", o LiveKit ainda pode listar a
// pessoa por um instante (desconectando)
const RELEITURA_MS = 2000;

// a call do hall do mundo 3D (hall-<servidorId>) não é um canal: fica fora disso
export const ehSalaDoHall = (nome: string) => nome.startsWith("hall-");

type Foto = Map<string, { tela: boolean }>;

async function fotoDaSala(canalId: string): Promise<Foto> {
    // sala vazia some do LiveKit: "não existe" é o mesmo que ninguém
    const pessoas = await roomService.listParticipants(canalId).catch((e) => {
        if (/not.?found|does not exist/i.test(String(e?.message ?? e))) return [];
        throw e;
    });
    return new Map(pessoas
        .filter((p) => p.state !== ParticipantInfo_State.DISCONNECTED)
        .map((p) => [p.identity, { tela: p.tracks.some((t) => t.source === TrackSource.SCREEN_SHARE) }]));
}

// aplica a foto à memória e avisa o servidor do canal das diferenças.
// Uma por canal de cada vez (webhook e conferência geral podem cair juntos)
const filas = new Map<string, Promise<void>>();
function aplicar(canalId: string, foto: Foto) {
    const anterior = filas.get(canalId) ?? Promise.resolve();
    const agora = anterior.then(() => aplicarAgora(canalId, foto)).catch((e) => console.log("aplicar foto da call falhou:", e?.message ?? e));
    filas.set(canalId, agora);
    agora.finally(() => {
        if (filas.get(canalId) === agora) filas.delete(canalId);
    });
    return agora;
}

async function aplicarAgora(canalId: string, foto: Foto) {
    const antes = participantesDaCall(canalId);
    const telasAntes = new Set(telasDaCall(canalId));
    const entraram = [...foto.keys()].filter((id) => !antes.includes(id));
    const sairam = antes.filter((id) => !foto.has(id));
    const telas = [...foto].filter(([id, p]) => p.tela !== telasAntes.has(id));
    if (entraram.length === 0 && sairam.length === 0 && telas.length === 0) return;

    const servidorId = await buscarServidor(canalId);
    if (!servidorId) return;

    for (const usuarioId of entraram) {
        entrouNaCall(canalId, usuarioId);
        await publicarParaServidor(servidorId, { tipo: "ENTROU_NA_CALL", canalId, usuarioId, inicioCall: devolverTempoCall(canalId) });
    }
    for (const usuarioId of sairam) {
        saiuDaCall(canalId, usuarioId);
        await publicarParaServidor(servidorId, { tipo: "SAIU_DA_CALL", canalId, usuarioId });
    }
    for (const [usuarioId, p] of telas) {
        mudarTela(canalId, usuarioId, p.tela);
        await publicarParaServidor(servidorId, { tipo: "TELA", canalId, usuarioId, statusTela: p.tela ? statusTela.ABRIU : statusTela.FECHOU });
    }
    // esvaziou: o YouTube e o controle da sala vão embora junto
    if (foto.size === 0) {
        if (limparYoutube(canalId)) await publicarParaServidor(servidorId, { tipo: "YT_ESTADO", agora: Date.now(), estado: estadoYoutube(canalId) });
        if (limparSala(canalId)) await publicarParaServidor(servidorId, { tipo: "SALA_ESTADO", estado: estadoSala(canalId) });
    }
}

// chegou webhook desta sala: lê a sala logo em seguida, e de novo um pouco depois
const agendadas = new Map<string, ReturnType<typeof setTimeout>[]>();
export function conferirSala(canalId: string) {
    if (ehSalaDoHall(canalId)) return;
    agendadas.get(canalId)?.forEach(clearTimeout);
    const ler = () => fotoDaSala(canalId)
        .then((foto) => aplicar(canalId, foto))
        .catch((e) => console.log(`ler a call ${canalId} no LiveKit falhou:`, e?.message ?? e));
    agendadas.set(canalId, [setTimeout(ler, ESPERA_WEBHOOK_MS), setTimeout(() => {
        agendadas.delete(canalId);
        ler();
    }, RELEITURA_MS)]);
}

async function conferir() {
    const salas = await roomService.listRooms();
    const noLiveKit = new Map<string, Foto>();
    for (const sala of salas) {
        if (ehSalaDoHall(sala.name)) continue;
        noLiveKit.set(sala.name, sala.numParticipants > 0 ? await fotoDaSala(sala.name) : new Map());
    }
    // salas que a gente acha que têm gente, mas o LiveKit nem tem mais (ninguém nelas)
    const canais = new Set([...noLiveKit.keys(), ...participantesNaMemoria()]);
    for (const canalId of canais) await aplicar(canalId, noLiveKit.get(canalId) ?? new Map());
}

let memoria: () => string[] = () => [];
const participantesNaMemoria = () => memoria();

export function iniciarSincronizacaoCalls(canaisComGente: () => string[]) {
    memoria = canaisComGente;
    const rodar = () => conferir().catch((e) => console.log("conferir calls com o LiveKit falhou:", e?.message ?? e));
    rodar();
    setInterval(rodar, INTERVALO_MS);
}
