// Áudio espacial: a voz de cada pessoa da call sai de onde o boneco dela está.
// Enquanto o 3D está aberto, o RoomAudioRenderer toca com volume 0 (o <audio> continua
// ligado, o Chrome precisa disso pra entregar o som ao Web Audio) e o som de verdade
// passa por aqui: fonte -> panner (direção + distância) -> volume geral -> saída.
//
// O áudio da tela que está na TV da sala sai pelas caixas de som (surround): o canal
// esquerdo nas caixas da esquerda, o direito nas da direita, a mistura no centro.
// Como cada caixa é um ponto no espaço, cada lugar da sala ouve diferente.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEvent, Track, type Room } from "livekit-client";
import type { CaixaSom, Ponto } from "./planta";

const ALTURA_VOZ = 1.6;

// fixa = caixa de som (não se mexe); senão segue o boneco de `identidade`
type Fonte = { identidade: string; nos: AudioNode[]; panner: PannerNode | null };

// a tela que está na TV: de quem é, onde ficam as caixas e como tocar
export type SomDaTV = {
    identidade: string;
    caixas: CaixaSom[];
    // ponto da TV, pra quando o surround está desligado (sai tudo de um lugar só)
    tela: Ponto & { y: number };
    surround: boolean;
    volume: number;
    // até quantos metros as caixas soam cheias (sala maior, como o cinema, precisa de mais)
    alcance: number;
};

type Props = {
    sala: Room | undefined;
    posicoes: Map<string, Ponto>;
    surdo: boolean;
    tv: SomDaTV | null;
    // call do hall: a voz cai mais com a distância
    proximidade: boolean;
};

// proximidade: voz na call do hall, cai bem mais com a distância (quem está longe quase some)
function novoPanner(ctx: BaseAudioContext, posicao?: { x: number; y: number; z: number }, caixa = false, alcance = 2.6, proximidade = false) {
    const panner = new PannerNode(ctx, {
        panningModel: "HRTF",
        // som de um ponto só: estéreo vira mono antes (senão o lado esquerdo do som ficaria
        // sempre no ouvido esquerdo, não importa de onde ele vem)
        channelCount: 1,
        channelCountMode: "explicit",
        ...(caixa
            // caixa de som: até `alcance` metros soa cheia, depois cai com a distância
            ? { distanceModel: "inverse" as const, refDistance: alcance, rolloffFactor: 1, maxDistance: 60 }
            : proximidade
                ? { distanceModel: "inverse" as const, refDistance: 1.5, rolloffFactor: 1.3, maxDistance: 40 }
                // voz numa sala: linear com piso, quem está do outro lado ainda é ouvido (a call é uma só)
                : { distanceModel: "linear" as const, refDistance: 1.5, maxDistance: 14, rolloffFactor: 0.72 }),
    });
    if (posicao) {
        panner.positionX.value = posicao.x;
        panner.positionY.value = posicao.y;
        panner.positionZ.value = posicao.z;
    }
    return panner;
}

// "sala" sintética pro reverb das traseiras: ruído que vai sumindo em ~1,2 s, depois de 20 ms
// de silêncio. Cada caixa com o seu ruído (semente diferente), pra as duas não soarem iguais
const impulsos = new Map<string, AudioBuffer>();
function impulsoDaSala(ctx: BaseAudioContext, semente: number) {
    const chave = `${ctx.sampleRate}|${semente}`;
    let buffer = impulsos.get(chave);
    if (!buffer) {
        const taxa = ctx.sampleRate;
        const atraso = Math.floor(taxa * 0.02);
        const tamanho = Math.floor(taxa * 1.2);
        buffer = ctx.createBuffer(1, tamanho, taxa);
        const dados = buffer.getChannelData(0);
        let s = semente * 9301 + 49297;
        for (let i = atraso; i < tamanho; i++) {
            s = (s * 9301 + 49297) % 233280;
            dados[i] = ((s / 233280) * 2 - 1) * Math.pow(1 - (i - atraso) / (tamanho - atraso), 3);
        }
        impulsos.set(chave, buffer);
    }
    return buffer;
}

// liga o som da tela nas caixas. Devolve todos os nós (pra desligar depois) e o volume da TV.
// (exportada pra dar pra testar o roteamento com um sinal de teste)
//
// Mistura no estilo dos decodificadores de cinema (Pro Logic): frente esquerda/direita recebem
// o esquerdo/direito; o centro, um pouco da soma (onde ficam as vozes do filme); as traseiras
// a DIFERENÇA entre os lados (o "ambiente": eco, plateia, música aberta), atrasada e abafada,
// mais um reverb do som inteiro (cada traseira com um reverb diferente). Assim as de trás sempre
// tocam algo, sem repetir o som da frente igualzinho (cópia do mesmo som de vários lugares embola)
export function ligarNasCaixas(ctx: BaseAudioContext, entrada: AudioNode, saida: AudioNode, tv: SomDaTV) {
    const volume = ctx.createGain();
    volume.gain.value = tv.volume / 100;
    // mono vira estéreo (os dois lados com o mesmo som)
    volume.channelCount = 2;
    volume.channelCountMode = "explicit";
    volume.channelInterpretation = "speakers";
    entrada.connect(volume);
    const nos: AudioNode[] = [volume];

    if (!tv.surround || tv.caixas.length < 5) {
        // uma caixa só soa bem mais baixo que cinco somadas: compensa pra trocar o modo não pular o volume
        const reforco = ctx.createGain();
        reforco.gain.value = 1.6;
        const panner = novoPanner(ctx, tv.tela, true, tv.alcance);
        volume.connect(reforco).connect(panner).connect(saida);
        return { nos: [...nos, reforco, panner], volume };
    }

    const lados = ctx.createChannelSplitter(2);
    volume.connect(lados);
    nos.push(lados);

    // uma caixa: esquerdo × pesoE + direito × pesoD -> (atraso + abafar, nas traseiras) -> caixa.
    // Devolve a entrada da caixa (pra somar o reverb nas traseiras)
    const alimentar = (i: number, pesoE: number, pesoD: number, atraso = 0) => {
        const soma = ctx.createGain();
        nos.push(soma);
        ([[0, pesoE], [1, pesoD]] as const).forEach(([canal, peso]) => {
            if (!peso) return;
            const g = ctx.createGain();
            g.gain.value = peso;
            lados.connect(g, canal);
            g.connect(soma);
            nos.push(g);
        });
        let ultimo: AudioNode = soma;
        if (atraso) {
            const espera = ctx.createDelay(0.1);
            espera.delayTime.value = atraso;
            const abafar = ctx.createBiquadFilter();
            abafar.type = "lowpass";
            abafar.frequency.value = 7000;
            ultimo.connect(espera).connect(abafar);
            ultimo = abafar;
            nos.push(espera, abafar);
        }
        const panner = novoPanner(ctx, tv.caixas[i], true, tv.alcance);
        ultimo.connect(panner).connect(saida);
        nos.push(panner);
        return panner;
    };
    alimentar(0, 0.8, 0); // frente esquerda
    alimentar(1, 0.3, 0.3); // centro
    alimentar(2, 0, 0.8); // frente direita
    const traseiras = [
        alimentar(3, 0.6, -0.6, 0.018), // traseira esquerda: E − D
        alimentar(4, -0.6, 0.6, 0.023), // traseira direita: D − E (atraso um pouco diferente, soa mais aberto)
    ];

    // ambiência: o som inteiro (E + D) passando pela "sala", um reverb diferente em cada traseira
    const inteiro = ctx.createGain();
    inteiro.gain.value = 1;
    inteiro.channelCount = 1;
    inteiro.channelCountMode = "explicit";
    volume.connect(inteiro);
    nos.push(inteiro);
    traseiras.forEach((caixa, n) => {
        const sala = ctx.createConvolver();
        sala.buffer = impulsoDaSala(ctx, n + 1);
        // o convolver do navegador normaliza o reverb e ele sai bem baixo: este ganho deixa as
        // traseiras em ~30% do volume da frente (som em volta sem roubar a frente)
        const quanto = ctx.createGain();
        quanto.gain.value = 1.8;
        inteiro.connect(sala).connect(quanto).connect(caixa);
        nos.push(sala, quanto);
    });
    return { nos, volume };
}

export function AudioEspacial({ sala, posicoes, surdo, tv, proximidade }: Props) {
    const contexto = useRef<AudioContext | null>(null);
    const geral = useRef<GainNode | null>(null);
    const fontes = useRef(new Map<string, Fonte>());
    const volumeTV = useRef<GainNode | null>(null);
    const frente = useRef(new THREE.Vector3());
    const tvRef = useRef(tv);
    tvRef.current = tv;

    useEffect(() => {
        const ctx = new AudioContext();
        const ganho = ctx.createGain();
        ganho.connect(ctx.destination);
        contexto.current = ctx;
        geral.current = ganho;

        // o navegador só deixa o áudio começar depois de um clique ou tecla
        const destravar = () => {
            if (ctx.state === "suspended") ctx.resume().catch(() => {});
        };
        destravar();
        window.addEventListener("pointerdown", destravar);
        window.addEventListener("keydown", destravar);

        return () => {
            window.removeEventListener("pointerdown", destravar);
            window.removeEventListener("keydown", destravar);
            contexto.current = null;
            geral.current = null;
            ctx.close().catch(() => {});
        };
    }, []);

    // trocar a tela da TV ou ligar/desligar o surround religa as fontes (o volume não precisa)
    const chaveTV = tv ? `${tv.identidade}|${tv.surround}|${tv.caixas.map((c) => `${c.x},${c.z}`).join(";")}` : "";

    useEffect(() => {
        const ctx = contexto.current;
        const saida = geral.current;
        if (!sala || !ctx || !saida) return;
        const mapa = fontes.current;

        const soltar = (chave: string) => {
            const f = mapa.get(chave);
            if (!f) return;
            f.nos.forEach((n) => n.disconnect());
            mapa.delete(chave);
        };

        // confere quem está na call e liga/desliga as fontes (voz e áudio de tela)
        const montar = () => {
            const vistas = new Set<string>();
            const somTV = tvRef.current;
            sala.remoteParticipants.forEach((p) => {
                p.audioTrackPublications.forEach((pub) => {
                    const faixa = pub.track?.mediaStreamTrack;
                    if (!faixa) return;
                    vistas.add(faixa.id);
                    if (mapa.has(faixa.id)) return;
                    const fonte = ctx.createMediaStreamSource(new MediaStream([faixa]));
                    if (somTV && pub.source === Track.Source.ScreenShareAudio && p.identity === somTV.identidade) {
                        const { nos, volume } = ligarNasCaixas(ctx, fonte, saida, somTV);
                        volumeTV.current = volume;
                        mapa.set(faixa.id, { identidade: p.identity, nos: [fonte, ...nos], panner: null });
                    } else {
                        const panner = novoPanner(ctx, undefined, false, 2.6, proximidade);
                        fonte.connect(panner).connect(saida);
                        mapa.set(faixa.id, { identidade: p.identity, nos: [fonte, panner], panner });
                    }
                });
            });
            [...mapa.keys()].filter((k) => !vistas.has(k)).forEach(soltar);
        };

        montar();
        sala.on(RoomEvent.TrackSubscribed, montar);
        sala.on(RoomEvent.TrackUnsubscribed, montar);
        sala.on(RoomEvent.ParticipantDisconnected, montar);
        sala.on(RoomEvent.Disconnected, montar);
        return () => {
            sala.off(RoomEvent.TrackSubscribed, montar);
            sala.off(RoomEvent.TrackUnsubscribed, montar);
            sala.off(RoomEvent.ParticipantDisconnected, montar);
            sala.off(RoomEvent.Disconnected, montar);
            [...mapa.keys()].forEach(soltar);
            volumeTV.current = null;
        };
    }, [sala, chaveTV, proximidade]);

    useEffect(() => {
        const ctx = contexto.current;
        geral.current?.gain.setTargetAtTime(surdo ? 0 : 1, ctx?.currentTime ?? 0, 0.05);
    }, [surdo]);

    // volume da TV escolhido no controle da sala
    const volumeAgora = tv?.volume ?? null;
    useEffect(() => {
        const ctx = contexto.current;
        if (volumeAgora !== null) volumeTV.current?.gain.setTargetAtTime(volumeAgora / 100, ctx?.currentTime ?? 0, 0.05);
    }, [volumeAgora]);

    useFrame(({ camera }) => {
        const ctx = contexto.current;
        if (!ctx) return;
        const { x, y, z } = camera.position;
        // Web Audio joga erro com número inválido (NaN): melhor pular o quadro
        if (!Number.isFinite(x + y + z)) return;
        const f = camera.getWorldDirection(frente.current);
        const ouvinte = ctx.listener;

        // Firefox ainda só tem a API antiga (setPosition/setOrientation)
        if (ouvinte.positionX) {
            ouvinte.positionX.value = x;
            ouvinte.positionY.value = y;
            ouvinte.positionZ.value = z;
            ouvinte.forwardX.value = f.x;
            ouvinte.forwardY.value = f.y;
            ouvinte.forwardZ.value = f.z;
            ouvinte.upX.value = 0;
            ouvinte.upY.value = 1;
            ouvinte.upZ.value = 0;
        } else {
            ouvinte.setPosition(x, y, z);
            ouvinte.setOrientation(f.x, f.y, f.z, 0, 1, 0);
        }

        fontes.current.forEach(({ identidade, panner }) => {
            // caixa de som: já está no lugar
            if (!panner) return;
            // sem boneco (não deveria acontecer): toca "dentro da cabeça", sem direção
            const p = posicoes.get(identidade);
            panner.positionX.value = p ? p.x : x;
            panner.positionY.value = p ? ALTURA_VOZ : y;
            panner.positionZ.value = p ? p.z : z;
        });
    });

    return null;
}
