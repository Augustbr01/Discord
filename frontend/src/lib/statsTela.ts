import { useEffect, useState } from "react";
import { isTrackReference, useRoomContext, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { LocalVideoTrack, RemoteVideoTrack, RoomEvent, type RemoteParticipant } from "livekit-client";

// o que está passando de verdade na transmissão de uma tela (não o que foi pedido: o navegador
// derruba resolução e fps quando a rede ou o computador apertam)
export type StatsVideo = {
    largura: number;
    altura: number;
    fps: number;
    kbps: number;
    codec: string | null;
    // só do envio: o que está segurando a qualidade
    limitacao?: "cpu" | "bandwidth" | null;
    // só da recepção: % dos pacotes que se perderam
    perda?: number;
};

// quem compartilha manda o próprio envio pra sala por aqui (quem assiste não tem como ler)
export const TOPICO_STATS_TELA = "stats-tela";
export const INTERVALO_STATS_MS = 2000;

const codecDoMime = (mime?: string) => (mime ? mime.replace(/^video\//i, "").toUpperCase() : null);

// RTCStats.timestamp é em ms: bytes * 8 / ms = kbit/s
const kbpsEntre = (bytes: number, antes: number, em: number, emAntes: number) => ((bytes - antes) * 8) / (em - emAntes);

// envio: com simulcast são várias camadas e vale a maior que está saindo (com SVC é uma só, com
// as outras dentro). O bitrate é a soma de todas. Primeira leitura: null (falta com o que comparar)
export function leitorDeEnvio(track: LocalVideoTrack) {
    let anterior: { bytes: number; em: number } | null = null;
    return async (): Promise<StatsVideo | null> => {
        const camadas = await track.getSenderStats();
        if (camadas.length === 0) return null;
        const ativas = camadas.filter((c) => c.framesPerSecond > 0);
        const area = (c: (typeof camadas)[number]) => (c.frameWidth ?? 0) * (c.frameHeight ?? 0);
        const maior = (ativas.length > 0 ? ativas : camadas).reduce((a, b) => (area(b) > area(a) ? b : a));
        const bytes = camadas.reduce((soma, c) => soma + (c.bytesSent ?? 0), 0);
        const em = maior.timestamp;
        const antes = anterior;
        anterior = { bytes, em };
        if (!antes || em <= antes.em) return null;
        const motivo = maior.qualityLimitationReason;
        return {
            largura: maior.frameWidth ?? 0,
            altura: maior.frameHeight ?? 0,
            fps: Math.round(maior.framesPerSecond ?? 0),
            kbps: Math.round(kbpsEntre(bytes, antes.bytes, em, antes.em)),
            codec: track.codec ? track.codec.toUpperCase() : null,
            limitacao: motivo === "cpu" || motivo === "bandwidth" ? motivo : null,
        };
    };
}

// recepção: o navegador não dá o fps pronto, sai dos quadros decodificados entre duas leituras
export function leitorDeRecepcao(track: RemoteVideoTrack) {
    let anterior: { bytes: number; quadros: number; perdidos: number; recebidos: number; em: number } | null = null;
    return async (): Promise<StatsVideo | null> => {
        const s = await track.getReceiverStats();
        if (!s) return null;
        const atual = {
            bytes: s.bytesReceived ?? 0,
            quadros: s.framesDecoded ?? 0,
            perdidos: s.packetsLost ?? 0,
            recebidos: s.packetsReceived ?? 0,
            em: s.timestamp,
        };
        const antes = anterior;
        anterior = atual;
        if (!antes || atual.em <= antes.em) return null;
        const dt = atual.em - antes.em;
        const perdidos = atual.perdidos - antes.perdidos;
        const total = perdidos + (atual.recebidos - antes.recebidos);
        return {
            largura: s.frameWidth ?? 0,
            altura: s.frameHeight ?? 0,
            fps: Math.round(((atual.quadros - antes.quadros) * 1000) / dt),
            kbps: Math.round(kbpsEntre(atual.bytes, antes.bytes, atual.em, antes.em)),
            codec: codecDoMime(s.mimeType),
            perda: total > 0 ? (Math.max(0, perdidos) / total) * 100 : 0,
        };
    };
}

// o que chega dos outros pela sala: só números e um nome de codec curto, nada mais
function lerStatsRecebido(texto: string): StatsVideo | null {
    try {
        const d = JSON.parse(texto);
        const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
        return {
            largura: numero(d?.largura),
            altura: numero(d?.altura),
            fps: numero(d?.fps),
            kbps: numero(d?.kbps),
            codec: typeof d?.codec === "string" ? d.codec.slice(0, 8) : null,
            limitacao: d?.limitacao === "cpu" || d?.limitacao === "bandwidth" ? d.limitacao : null,
        };
    } catch {
        return null;
    }
}

// estatísticas de uma tela enquanto o painel está aberto (ativo).
// A sua: o seu envio, lido aqui. A dos outros: o que você recebe (lido aqui) e o que quem
// compartilha está enviando (ele manda pela sala a cada INTERVALO_STATS_MS)
export function useStatsTela(trackRef: TrackReferenceOrPlaceholder, ativo: boolean) {
    const room = useRoomContext();
    const [envio, setEnvio] = useState<StatsVideo | null>(null);
    const [recepcao, setRecepcao] = useState<StatsVideo | null>(null);
    const track = isTrackReference(trackRef) ? trackRef.publication.track : undefined;
    const participante = trackRef.participant;

    useEffect(() => {
        setEnvio(null);
        setRecepcao(null);
        if (!ativo || !track) return;
        let ler: (() => Promise<StatsVideo | null>) | null = null;
        let aplicar = setRecepcao;
        if (track instanceof LocalVideoTrack) {
            ler = leitorDeEnvio(track);
            aplicar = setEnvio;
        } else if (track instanceof RemoteVideoTrack) {
            ler = leitorDeRecepcao(track);
        }
        if (!ler) return;
        let vivo = true;
        const passo = () => {
            ler!().then((s) => {
                if (vivo && s) aplicar(s);
            }).catch(() => {});
        };
        passo();
        const id = setInterval(passo, 1000);
        return () => {
            vivo = false;
            clearInterval(id);
        };
    }, [ativo, track]);

    useEffect(() => {
        if (!ativo || participante.isLocal) return;
        const decodificador = new TextDecoder();
        const aoReceber = (dados: Uint8Array, de?: RemoteParticipant, _tipo?: unknown, topico?: string) => {
            if (topico !== TOPICO_STATS_TELA || de?.identity !== participante.identity) return;
            const stats = lerStatsRecebido(decodificador.decode(dados));
            if (stats) setEnvio(stats);
        };
        room.on(RoomEvent.DataReceived, aoReceber);
        return () => {
            room.off(RoomEvent.DataReceived, aoReceber);
        };
    }, [ativo, room, participante]);

    return { envio, recepcao };
}
