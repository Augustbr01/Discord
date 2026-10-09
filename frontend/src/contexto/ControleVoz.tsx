import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    RoomAudioRenderer, useConnectionState, useLocalParticipant, useRemoteParticipants, useTrackToggle,
} from "@livekit/components-react";
import {
    AudioPresets, ConnectionState, LocalVideoTrack, ScreenSharePresets, Track, VideoPreset, type TrackPublishOptions,
} from "livekit-client";
import { desktop } from "../lib/desktop";
import { somAlternar } from "../lib/som";
import { INTERVALO_STATS_MS, TOPICO_STATS_TELA, leitorDeEnvio } from "../lib/statsTela";
import { lerArmazenado, salvarArmazenado } from "../lib/util";
import { useToast } from "./Toasts";

// ---------- compartilhamento de tela ----------

// resolução e fps escolhidos separados; os presets são só combinações prontas dos dois
export type ResolucaoTela = "720" | "1080" | "1440" | "nativa";
export type FpsTela = 15 | 30 | 60;
export type ConfigTela = { resolucao: ResolucaoTela; fps: FpsTela };

export const RESOLUCOES_TELA: { id: ResolucaoTela; titulo: string }[] = [
    { id: "720", titulo: "720p" },
    { id: "1080", titulo: "1080p" },
    { id: "1440", titulo: "1440p" },
    { id: "nativa", titulo: "Nativa" },
];
export const FPS_TELA: FpsTela[] = [15, 30, 60];

export type PresetTela = { id: string; titulo: string; detalhe: string; config: ConfigTela };
export const PRESETS_TELA: PresetTela[] = [
    { id: "texto", titulo: "Texto e código", detalhe: "1080p · 15 fps · mais nítido", config: { resolucao: "1080", fps: 15 } },
    { id: "video", titulo: "Vídeo e jogos", detalhe: "720p · 30 fps · mais fluido", config: { resolucao: "720", fps: 30 } },
    { id: "alta", titulo: "Alta", detalhe: "1080p · 30 fps · precisa de internet boa", config: { resolucao: "1080", fps: 30 } },
    { id: "4k60", titulo: "4K 60 fps", detalhe: "Nativa (até 4K) · 60 fps · PC forte e internet muito boa", config: { resolucao: "nativa", fps: 60 } },
];

export const presetDaConfig = (c: ConfigTela) =>
    PRESETS_TELA.find((p) => p.config.resolucao === c.resolucao && p.config.fps === c.fps) ?? null;

// nativa = a resolução de onde você compartilha: o navegador não aumenta a imagem, então pedir
// 4K só limita (uma tela 5K sai em 4K, uma 1080p sai em 1080p)
const TAMANHOS: Record<ResolucaoTela, { largura: number; altura: number; bitrate30: number }> = {
    "720": { largura: 1280, altura: 720, bitrate30: 2_000_000 },
    "1080": { largura: 1920, altura: 1080, bitrate30: 5_000_000 },
    "1440": { largura: 2560, altura: 1440, bitrate30: 8_000_000 },
    nativa: { largura: 3840, altura: 2160, bitrate30: 10_000_000 },
};
const FATOR_FPS: Record<FpsTela, number> = { 15: 0.5, 30: 1, 60: 1.5 };

type CodecAvancado = "av1" | "vp9" | "h264";
// mesmo resultado com menos bits no AV1, mais no H.264
const FATOR_CODEC: Record<CodecAvancado, number> = { av1: 0.8, vp9: 1, h264: 1.3 };

const carga = (c: ConfigTela) => TAMANHOS[c.resolucao].largura * TAMANHOS[c.resolucao].altura * c.fps;
// acima de 1080p 30 fps o VP8 da sala pesa demais: vai o codec que o computador codifica no
// hardware. VP9 e AV1 mandam as camadas num stream só (SVC): cada um recebe a que cabe na tela
// e na rede dele
const usaCodecAvancado = (c: ConfigTela) => carga(c) > 1920 * 1080 * 30;
// acima de 1080p 60 fps: avisa que precisa de PC forte e internet muito boa
export const configPesada = (c: ConfigTela) => carga(c) > 1920 * 1080 * 60;

// quem não decodifica o codec escolhido (Safari antigo com AV1, por exemplo): a tela vai em VP8 1080p30
const RESERVA = { codec: "vp8" as const, encoding: ScreenSharePresets.h1080fps30.encoding };

async function codificaBem(codec: CodecAvancado) {
    const info = await navigator.mediaCapabilities.encodingInfo({
        type: "webrtc",
        video: { contentType: `video/${codec.toUpperCase()}`, width: 3840, height: 2160, framerate: 60, bitrate: 15_000_000 * FATOR_CODEC[codec] },
    });
    return info.supported && info.smooth && info.powerEfficient;
}

// o primeiro que codifica 4K 60 fps no hardware (AV1 no processador é o mais pesado de todos);
// nenhum: VP9 (o navegador derruba resolução/fps se o computador não aguentar)
async function escolherCodec(): Promise<CodecAvancado> {
    try {
        for (const codec of ["av1", "vp9", "h264"] as const) {
            if (await codificaBem(codec)) return codec;
        }
    } catch {
        // navegador sem mediaCapabilities pra webrtc
    }
    return "vp9";
}

// descobre antes do clique: o Safari só abre a escolha da tela se ela for pedida direto no
// clique, sem esperar nada antes
let codecAvancado: CodecAvancado = "vp9";
if (typeof navigator !== "undefined" && navigator.mediaCapabilities) {
    void escolherCodec().then((c) => {
        codecAvancado = c;
    });
}

function presetDaTela(c: ConfigTela) {
    const { largura, altura, bitrate30 } = TAMANHOS[c.resolucao];
    const fator = FATOR_FPS[c.fps] * (usaCodecAvancado(c) ? FATOR_CODEC[codecAvancado] : 1);
    return new VideoPreset(largura, altura, Math.round(bitrate30 * fator), c.fps, configPesada(c) ? "high" : "medium");
}

// o que o navegador prioriza quando a rede ou o computador aperta: a 15 fps (texto) a nitidez,
// a 60 fps o fps. Nativa a 60 começa equilibrado e vira "o fps" se a tela não for 4K (ver iniciarTela)
function prioridade(c: ConfigTela): { dica: "detail" | "motion"; degradacao: RTCDegradationPreference } {
    if (c.fps === 15) return { dica: "detail", degradacao: "maintain-resolution" };
    if (c.fps === 60 && c.resolucao !== "nativa") return { dica: "motion", degradacao: "maintain-framerate" };
    return { dica: "motion", degradacao: "balanced" };
}

function publicacaoDaTela(c: ConfigTela): TrackPublishOptions {
    const base: TrackPublishOptions = {
        ...PUBLICAR_AUDIO_DA_TELA,
        screenShareEncoding: presetDaTela(c).encoding,
        degradationPreference: prioridade(c).degradacao,
    };
    if (!usaCodecAvancado(c)) return base;
    return { ...base, videoCodec: codecAvancado, backupCodec: RESERVA };
}

// sala de cinema: a tela vai sempre a 1080p 30 fps (filme a 15 fps fica travado)
const CONFIG_CINEMA: ConfigTela = { resolucao: "1080", fps: 30 };

type PreferenciasTela = ConfigTela & { audio: boolean };

// o que ficou salvo: a versão antiga guardava o nome do preset (`qualidade`)
const DO_PRESET_ANTIGO: Record<string, ConfigTela> = {
    texto: { resolucao: "1080", fps: 15 },
    video: { resolucao: "720", fps: 30 },
    maxima: { resolucao: "1080", fps: 30 },
    "4k60": { resolucao: "nativa", fps: 60 },
};
function lerPrefsTela(): PreferenciasTela {
    const salvo = lerArmazenado<Partial<PreferenciasTela> & { qualidade?: string }>(CHAVE_TELA, {});
    const audio = salvo.audio ?? true;
    const valida = RESOLUCOES_TELA.some((r) => r.id === salvo.resolucao) && FPS_TELA.includes(salvo.fps as FpsTela);
    if (valida) return { resolucao: salvo.resolucao!, fps: salvo.fps!, audio };
    return { ...(DO_PRESET_ANTIGO[salvo.qualidade ?? ""] ?? DO_PRESET_ANTIGO.texto!), audio };
}

// áudio da tela é música/filme, não voz: em estéreo (o surround do 3D separa esquerda e direita),
// sem o tratamento de voz do navegador (anti-eco, anti-ruído e ganho automático estragam música)
// e sem dtx/red (que picotam o som), com bitrate de música
const AUDIO_DA_TELA = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 };
const PUBLICAR_AUDIO_DA_TELA = { audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: false, forceStereo: true };

const CHAVE_TELA = "liberdade:tela";
const CHAVE_VOLUMES = "liberdade:volumes";

// celular e alguns navegadores não têm getDisplayMedia
const TELA_SUPORTADA = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

// ---------- volume por pessoa ----------

export type TipoVolume = "voz" | "tela";
// 0 a 1 por pessoa (id do usuário = identity no LiveKit); ausente = 100%
type Volumes = Record<string, Partial<Record<TipoVolume, number>>>;

// o LiveKit só reaplica o volume num áudio que reconecta se ele for "verdadeiro"
// (`if (this.elementVolume)`), então 0 voltaria a tocar alto. Um valor inaudível resolve
const volumeReal = (v: number) => (v <= 0 ? 0.0001 : Math.min(v, 1));

type ControleVoz = {
    conectado: boolean;
    micLigado: boolean;
    micPendente: boolean;
    alternarMic: () => void;
    surdo: boolean;
    alternarSurdo: () => void;
    camera: { ligada: boolean; pendente: boolean; alternar: () => void };
    tela: {
        ativa: boolean;
        pendente: boolean;
        suportada: boolean;
        config: ConfigTela;
        comAudio: boolean;
        // preset: os dois de uma vez; o seletor avançado: um de cada vez
        definirConfig: (mudanca: Partial<ConfigTela>) => void;
        definirAudio: (ligado: boolean) => void;
        alternar: () => void;
        // escolher outra tela/janela sem sair do compartilhamento
        trocar: () => void;
    };
    volumeDe: (usuarioId: string, tipo: TipoVolume) => number;
    definirVolume: (usuarioId: string, tipo: TipoVolume, valor: number) => void;
};

const Ctx = createContext<ControleVoz | null>(null);

type Props = {
    // preferências guardadas no App (sobrevivem a trocar de sala)
    micPreferido: boolean;
    setMicPreferido: (ligado: boolean) => void;
    surdo: boolean;
    setSurdo: (surdo: boolean) => void;
    // mundo 3D aberto: o som sai pelo áudio espacial dele, não daqui
    audioEspacial?: boolean;
    // sala de cinema: a tela vai sempre a 1080p 30 fps (filme a 15 fps fica travado)
    cinema?: boolean;
    children: ReactNode;
};

// microfone e "áudio desligado" funcionam dentro e fora da chamada:
// fora dela viram preferência (você entra já mutado), dentro dela agem na hora.
// Câmera, tela e volumes ficam aqui também, pra barra da chamada e o painel lateral
// mostrarem o mesmo estado. Os avisos de falha de câmera/microfone saem do
// onMediaDeviceFailure do LiveKitRoom (no App), por isso os toggles aqui só engolem o erro
export function ControleVozProvider({ micPreferido, setMicPreferido, surdo, setSurdo, audioEspacial = false, cinema = false, children }: Props) {
    const toast = useToast();
    const estado = useConnectionState();
    const conectado = estado === ConnectionState.Connected;
    const { localParticipant, isScreenShareEnabled } = useLocalParticipant();

    // ---------- microfone e áudio ----------

    const mic = useTrackToggle({ source: Track.Source.Microphone, onDeviceError: () => setMicPreferido(false) });

    const micLigado = conectado ? mic.enabled : micPreferido;
    const micAntesDeSurdo = useRef(micLigado);
    const alternarFaixa = mic.toggle;

    const definirMic = useCallback((ligar: boolean) => {
        setMicPreferido(ligar);
        if (conectado) alternarFaixa(ligar);
    }, [conectado, alternarFaixa, setMicPreferido]);

    const alternarMic = useCallback(() => {
        // ligar o microfone também volta a ouvir a sala
        if (!micLigado && surdo) setSurdo(false);
        definirMic(!micLigado);
    }, [micLigado, surdo, setSurdo, definirMic]);

    const alternarSurdo = useCallback(() => {
        if (surdo) {
            setSurdo(false);
            if (micAntesDeSurdo.current) definirMic(true);
        } else {
            // quem desliga o áudio também fica mudo, e o microfone volta ao religar
            micAntesDeSurdo.current = micLigado;
            setSurdo(true);
            if (micLigado) definirMic(false);
        }
    }, [surdo, micLigado, setSurdo, definirMic]);

    // app desktop: atalhos globais e a bandeja alternam daqui, mesmo com a janela escondida
    // (por isso o som: sem ele não dá pra saber se mutou). E a bandeja mostra o estado
    useEffect(() => desktop?.aoAtalho((atalho) => {
        if (atalho === "mic") {
            somAlternar(!micLigado);
            alternarMic();
        } else {
            somAlternar(surdo);
            alternarSurdo();
        }
    }), [micLigado, surdo, alternarMic, alternarSurdo]);

    useEffect(() => {
        desktop?.definirVoz({ conectado, mic: micLigado, surdo });
    }, [conectado, micLigado, surdo]);

    // ---------- câmera ----------

    const cameraToggle = useTrackToggle({ source: Track.Source.Camera, onDeviceError: () => {} });
    const alternarCamera = cameraToggle.toggle;
    const camera = useMemo(() => ({
        ligada: cameraToggle.enabled,
        pendente: cameraToggle.pending,
        alternar: () => void alternarCamera(),
    }), [cameraToggle.enabled, cameraToggle.pending, alternarCamera]);

    // ---------- tela ----------

    const [prefsTela, setPrefsTela] = useState<PreferenciasTela>(() =>
        lerPrefsTela(),
    );
    const [telaPendente, setTelaPendente] = useState(false);

    const atualizarPrefsTela = useCallback((mudanca: Partial<PreferenciasTela>) => {
        setPrefsTela((atual) => {
            const novo = { ...atual, ...mudanca };
            salvarArmazenado(CHAVE_TELA, novo);
            return novo;
        });
    }, []);

    const iniciarTela = useCallback(async () => {
        const config: ConfigTela = cinema ? CONFIG_CINEMA : { resolucao: prefsTela.resolucao, fps: prefsTela.fps };
        setTelaPendente(true);
        try {
            const publicacao = await localParticipant.setScreenShareEnabled(
                true,
                {
                    audio: prefsTela.audio ? AUDIO_DA_TELA : false,
                    systemAudio: prefsTela.audio ? "include" : "exclude",
                    resolution: presetDaTela(config).resolution,
                    contentHint: prioridade(config).dica,
                    // não oferece a própria aba do Liberdade (viraria um túnel infinito)
                    selfBrowserSurface: "exclude",
                    // o Chrome mostra "compartilhar esta aba" pra trocar de aba sem parar
                    surfaceSwitching: "include",
                },
                publicacaoDaTela(config),
            );
            // nativa a 60 fps numa tela menor que 4K (o navegador não aumenta a imagem): sobra o 60 fps,
            // então é ele que fica. Se a rede ou o computador apertar, cai a resolução, nunca o fps
            const video = publicacao?.videoTrack;
            if (config.resolucao === "nativa" && config.fps === 60 && video instanceof LocalVideoTrack) {
                const { width = 0, height = 0 } = video.mediaStreamTrack.getSettings();
                if (width * height < 3840 * 2160) await video.setDegradationPreference("maintain-framerate");
            }
        } catch (err) {
            const nome = err instanceof Error ? err.name : "";
            const texto = err instanceof Error ? err.message : "";
            // bloqueado pelo sistema (macOS sem permissão de gravação de tela)
            if (nome === "NotAllowedError" && /system/i.test(texto)) {
                toast.erro("O sistema bloqueou a captura de tela. Libere o navegador nas permissões de gravação de tela.");
            } else if (nome === "DeviceUnsupportedError") {
                toast.erro("Seu navegador não permite compartilhar a tela.");
            } else if (nome !== "NotAllowedError" && nome !== "AbortError") {
                // NotAllowedError/AbortError comuns = você fechou a janela de escolha: não é erro
                toast.erro("Não consegui compartilhar a tela.");
            }
        } finally {
            setTelaPendente(false);
        }
    }, [localParticipant, prefsTela, cinema, toast]);

    const pararTela = useCallback(async () => {
        setTelaPendente(true);
        try {
            await localParticipant.setScreenShareEnabled(false);
        } finally {
            setTelaPendente(false);
        }
    }, [localParticipant]);

    // enquanto você compartilha: manda pra sala o que está saindo de verdade (resolução, fps...),
    // pro painel de estatísticas de quem assiste (o navegador dele não tem como saber).
    // Sem garantia de entrega: perder uma leitura não faz falta, a próxima vem logo
    useEffect(() => {
        if (!isScreenShareEnabled) return;
        const track = localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
        if (!(track instanceof LocalVideoTrack)) return;
        const ler = leitorDeEnvio(track);
        const codificador = new TextEncoder();
        const id = setInterval(() => {
            ler().then((stats) => {
                if (!stats) return;
                return localParticipant.publishData(codificador.encode(JSON.stringify(stats)), { reliable: false, topic: TOPICO_STATS_TELA });
            }).catch(() => {});
        }, INTERVALO_STATS_MS);
        return () => clearInterval(id);
    }, [isScreenShareEnabled, localParticipant]);

    const tela = useMemo<ControleVoz["tela"]>(() => ({
        ativa: isScreenShareEnabled,
        pendente: telaPendente,
        suportada: TELA_SUPORTADA,
        config: { resolucao: prefsTela.resolucao, fps: prefsTela.fps },
        comAudio: prefsTela.audio,
        definirConfig: (mudanca) => atualizarPrefsTela(mudanca),
        definirAudio: (audio) => atualizarPrefsTela({ audio }),
        alternar: () => void (isScreenShareEnabled ? pararTela() : iniciarTela()),
        // a janela de escolha precisa nascer do clique: para e já pede de novo
        trocar: () => void pararTela().then(iniciarTela),
    }), [isScreenShareEnabled, telaPendente, prefsTela, atualizarPrefsTela, pararTela, iniciarTela]);

    // ---------- volume por pessoa ----------

    const [volumes, setVolumes] = useState<Volumes>(() => lerArmazenado<Volumes>(CHAVE_VOLUMES, {}));
    const remotos = useRemoteParticipants();

    // aplica em quem está na sala; o LiveKit guarda por fonte e reaplica quando o áudio
    // (re)conecta, então quem chega depois ou volta a compartilhar já vem no volume certo.
    // No 3D o <audio> fica inaudível (o som sai pelo áudio espacial): aqui não pode religar ele
    useEffect(() => {
        for (const p of remotos) {
            const v = volumes[p.identity];
            p.setVolume(volumeReal(audioEspacial ? 0 : v?.voz ?? 1), Track.Source.Microphone);
            p.setVolume(volumeReal(audioEspacial ? 0 : v?.tela ?? 1), Track.Source.ScreenShareAudio);
        }
    }, [remotos, volumes, audioEspacial]);

    const volumeDe = useCallback((usuarioId: string, tipo: TipoVolume) => volumes[usuarioId]?.[tipo] ?? 1, [volumes]);

    const definirVolume = useCallback((usuarioId: string, tipo: TipoVolume, valor: number) => {
        setVolumes((atual) => {
            const novo = { ...atual, [usuarioId]: { ...atual[usuarioId], [tipo]: valor } };
            salvarArmazenado(CHAVE_VOLUMES, novo);
            return novo;
        });
    }, []);

    const valor = useMemo<ControleVoz>(() => ({
        conectado,
        micLigado,
        micPendente: conectado && mic.pending,
        alternarMic,
        surdo,
        alternarSurdo,
        camera,
        tela,
        volumeDe,
        definirVolume,
    }), [conectado, micLigado, mic.pending, alternarMic, surdo, alternarSurdo, camera, tela, volumeDe, definirVolume]);

    return (
        <Ctx.Provider value={valor}>
            {/* volume 0 (e não muted) no 3D: o <audio> continua recebendo, só não toca.
                Fora dele fica sem volume aqui, senão passaria por cima do volume por pessoa */}
            <RoomAudioRenderer muted={surdo} volume={audioEspacial ? 0 : undefined} />
            {children}
        </Ctx.Provider>
    );
}

export function useControleVoz() {
    const valor = useContext(Ctx);
    if (!valor) throw new Error("useControleVoz precisa estar dentro do ControleVozProvider");
    return valor;
}
