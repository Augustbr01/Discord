// Vídeo do LiveKit como textura 3D, e a foto de cada pessoa pro rosto do boneco.
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Track } from "livekit-client";
import { avatarReal, iniciais, tomNeutro } from "../../lib/util";
import { texturaIniciais } from "./texturas";

// O LiveKit usa o tamanho e a visibilidade do <video> pra escolher a qualidade
// (adaptiveStream): <video> escondido = vídeo pausado. Então os vídeos ficam numa
// caixa de verdade, no canto da tela, embaixo do canvas, e com o tamanho que a
// gente quer receber.
function caixaVideos() {
    let caixa = document.getElementById("mundo-videos");
    if (!caixa) {
        caixa = document.createElement("div");
        caixa.id = "mundo-videos";
        caixa.setAttribute("aria-hidden", "true");
        Object.assign(caixa.style, {
            position: "fixed", left: "0", top: "0", width: "1px", height: "1px",
            opacity: "0", pointerEvents: "none", zIndex: "-1",
        });
        document.body.append(caixa);
    }
    return caixa;
}

type Video = { video: HTMLVideoElement; textura: THREE.VideoTexture; usos: number };

// a mesma faixa pode aparecer em dois lugares (acima da pessoa e na TV): um <video> só
const videos = new Map<string, Video>();

function pegarVideo(track: Track, largura: number, altura: number) {
    const chave = `${track.sid ?? track.mediaStreamTrack.id}:${largura}x${altura}`;
    let v = videos.get(chave);
    if (!v) {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        Object.assign(video.style, { position: "absolute", left: "0", top: "0", width: `${largura}px`, height: `${altura}px` });
        caixaVideos().append(video);
        track.attach(video);
        video.play().catch(() => {});
        const textura = new THREE.VideoTexture(video);
        textura.colorSpace = THREE.SRGBColorSpace;
        v = { video, textura, usos: 0 };
        videos.set(chave, v);
    }
    v.usos++;

    const usado = v;
    return {
        ...usado,
        soltar() {
            usado.usos--;
            if (usado.usos > 0) return;
            videos.delete(chave);
            track.detach(usado.video);
            usado.video.remove();
            usado.textura.dispose();
        },
    };
}

export type TexturaVideo = { textura: THREE.VideoTexture; aspecto: number };

// largura/altura = tamanho do <video> = a qualidade que o LiveKit vai mandar
export function useTexturaVideo(track: Track | undefined, largura: number, altura: number): TexturaVideo | null {
    const [estado, setEstado] = useState<TexturaVideo | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const ultimoQuadro = useRef(-1);

    useEffect(() => {
        if (!track) {
            setEstado(null);
            return;
        }
        const v = pegarVideo(track, largura, altura);
        videoRef.current = v.video;

        const medir = () => {
            const { videoWidth: w, videoHeight: h } = v.video;
            setEstado({ textura: v.textura, aspecto: w && h ? w / h : 16 / 9 });
        };
        medir();
        v.video.addEventListener("loadedmetadata", medir);
        v.video.addEventListener("resize", medir);

        return () => {
            v.video.removeEventListener("loadedmetadata", medir);
            v.video.removeEventListener("resize", medir);
            videoRef.current = null;
            v.soltar();
            setEstado(null);
        };
    }, [track, largura, altura]);

    // o three atualiza a textura a cada quadro novo do vídeo (requestVideoFrameCallback),
    // mas nem todo navegador chama isso pra vídeo fora da tela: confere na mão também
    useFrame(() => {
        const video = videoRef.current;
        if (!video || !estado || video.readyState < 2) return;
        const quadros = video.getVideoPlaybackQuality?.().totalVideoFrames ?? -1;
        if (quadros === -1 || quadros !== ultimoQuadro.current) {
            ultimoQuadro.current = quadros;
            estado.textura.needsUpdate = true;
        }
    });

    return estado;
}

// foto do Discord no rosto do boneco; sem foto (ou se não carregar), as iniciais
const fotos = new Map<string, Promise<THREE.Texture>>();
const carregador = new THREE.TextureLoader().setCrossOrigin("anonymous");

// URL própria pro 3D: o <img> do app guarda no cache do navegador a mesma foto pedida
// sem CORS, e o WebGL (que pede com CORS) recebia essa cópia e recusava
function urlDoTresD(url: string) {
    return `${url}${url.includes("?") ? "&" : "?"}textura=3d`;
}

function carregarFoto(url: string) {
    let p = fotos.get(url);
    if (!p) {
        p = carregador.loadAsync(urlDoTresD(url)).then(
            (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                return t;
            },
            (erro) => {
                // não guarda a falha (ex.: o bucket ainda sem CORS): a próxima vez que o boneco
                // aparecer tenta de novo, sem precisar recarregar a página
                fotos.delete(url);
                throw erro;
            },
        );
        fotos.set(url, p);
    }
    return p;
}

// Foto animada (GIF, que o upload vira WebP animado): o TextureLoader só pega o primeiro quadro.
// Aqui o ImageDecoder do navegador decodifica um quadro de cada vez, no tempo de cada um, e
// desenha num canvas que é a textura. Uma animação por URL, dividida entre os bonecos que usam
// a mesma foto; para quando o último some. Sem ImageDecoder (navegador antigo), fica parada
type Animada = { textura: THREE.CanvasTexture; usos: number; parar: () => void };
const animadas = new Map<string, Promise<Animada | null>>();

async function abrirAnimada(url: string): Promise<Animada | null> {
    if (typeof ImageDecoder === "undefined") return null;
    const resposta = await fetch(urlDoTresD(url), { mode: "cors" });
    if (!resposta.ok) return null;
    const tipo = resposta.headers.get("content-type")?.split(";")[0] ?? "";
    if (!tipo.startsWith("image/") || !(await ImageDecoder.isTypeSupported(tipo))) return null;

    const decodificador = new ImageDecoder({ data: await resposta.arrayBuffer(), type: tipo });
    // as faixas primeiro (sem isso selectedTrack vem null), depois o arquivo inteiro (frameCount final)
    await decodificador.tracks.ready;
    await decodificador.completed;
    const faixa = decodificador.tracks.selectedTrack;
    if (!faixa || !faixa.animated || faixa.frameCount < 2) {
        decodificador.close();
        return null;
    }

    const primeiro = (await decodificador.decode({ frameIndex: 0 })).image;
    const canvas = document.createElement("canvas");
    canvas.width = primeiro.displayWidth;
    canvas.height = primeiro.displayHeight;
    primeiro.close();
    const ctx = canvas.getContext("2d")!;
    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;

    let quadro = 0;
    let parado = false;
    let espera: number | undefined;
    const passo = async () => {
        if (parado) return;
        try {
            const { image } = await decodificador.decode({ frameIndex: quadro });
            if (parado) {
                image.close();
                return;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            textura.needsUpdate = true;
            // duração em microssegundos; GIF com 0 ou quase 0 os navegadores tocam a 100 ms
            const ms = (image.duration ?? 0) / 1000;
            image.close();
            quadro = (quadro + 1) % faixa.frameCount;
            espera = window.setTimeout(passo, ms < 20 ? 100 : ms);
        } catch {
            // quadro com defeito: recomeça do primeiro
            quadro = 0;
            espera = window.setTimeout(passo, 100);
        }
    };
    void passo();

    return {
        textura,
        usos: 0,
        parar: () => {
            parado = true;
            window.clearTimeout(espera);
            decodificador.close();
            textura.dispose();
        },
    };
}

// pega a animação (ou null se a foto não for animada) e marca mais um boneco usando
async function usarAnimada(url: string) {
    let p = animadas.get(url);
    if (!p) {
        p = abrirAnimada(url).catch(() => null);
        animadas.set(url, p);
    }
    const a = await p;
    if (a) a.usos++;
    return a;
}

function soltarAnimada(url: string, a: Animada) {
    a.usos--;
    if (a.usos > 0) return;
    a.parar();
    animadas.delete(url);
}

export function useTexturaAvatar(nome: string, url: string | null | undefined) {
    const [textura, setTextura] = useState<THREE.Texture>(() => texturaIniciais(iniciais(nome), tomNeutro(nome)));

    useEffect(() => {
        const foto = avatarReal(url);
        if (!foto) return;
        let ativo = true;
        let animada: Animada | null = null;
        // a foto parada aparece logo; se for animada, troca pela animação quando ela estiver pronta
        carregarFoto(foto)
            .then((t) => {
                if (ativo && !animada) setTextura(t);
            })
            .catch(() => {});
        usarAnimada(foto).then((a) => {
            if (!a) return;
            if (!ativo) {
                soltarAnimada(foto, a);
                return;
            }
            animada = a;
            setTextura(a.textura);
        });
        return () => {
            ativo = false;
            if (animada) soltarAnimada(foto, animada);
        };
    }, [url]);

    return textura;
}
