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

function carregarFoto(url: string) {
    let p = fotos.get(url);
    if (!p) {
        p = carregador.loadAsync(url).then((t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            return t;
        });
        fotos.set(url, p);
    }
    return p;
}

export function useTexturaAvatar(nome: string, url: string | null | undefined) {
    const [textura, setTextura] = useState<THREE.Texture>(() => texturaIniciais(iniciais(nome), tomNeutro(nome)));

    useEffect(() => {
        const foto = avatarReal(url);
        if (!foto) return;
        let ativo = true;
        carregarFoto(foto)
            .then((t) => {
                if (ativo) setTextura(t);
            })
            .catch(() => {});
        return () => {
            ativo = false;
        };
    }, [url]);

    return textura;
}
