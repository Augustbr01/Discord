// YouTube: tirar o id do vídeo de um link e carregar a API do player embutido.
// Tipos só do pedaço da API que a gente usa (https://developers.google.com/youtube/iframe_api_reference)

export type PlayerYT = {
    loadVideoById(opcoes: { videoId: string; startSeconds?: number }): void;
    cueVideoById(opcoes: { videoId: string; startSeconds?: number }): void;
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(segundos: number, permitirBuscar: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    destroy(): void;
};

type ApiYT = {
    Player: new (
        elemento: HTMLElement,
        opcoes: {
            width?: string | number;
            height?: string | number;
            playerVars?: Record<string, string | number>;
            events?: {
                onReady?: () => void;
                onStateChange?: (e: { data: number }) => void;
                onError?: (e: { data: number }) => void;
            };
        },
    ) => PlayerYT;
};

// getPlayerState()
export const ESTADO_YT = { NAO_INICIADO: -1, TERMINOU: 0, TOCANDO: 1, PAUSADO: 2, CARREGANDO: 3, PRONTO: 5 } as const;

declare global {
    interface Window {
        YT?: ApiYT;
        onYouTubeIframeAPIReady?: () => void;
    }
}

let carregando: Promise<ApiYT> | null = null;

// o script do YouTube avisa que terminou chamando window.onYouTubeIframeAPIReady
export function carregarApiYoutube() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    carregando ??= new Promise<ApiYT>((resolve, reject) => {
        const anterior = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            anterior?.();
            resolve(window.YT!);
        };
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => {
            carregando = null;
            reject(new Error("Não deu para carregar o YouTube."));
        };
        document.head.append(script);
    });
    return carregando;
}

// aceita youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/, music.youtube.com e o id puro
export function extrairIdYoutube(texto: string): string | null {
    const t = texto.trim();
    if (/^[\w-]{11}$/.test(t)) return t;
    let url: URL;
    try {
        url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
}

// 75 -> "1:15", 3725 -> "1:02:05"
export function tempoVideo(segundos: number) {
    const total = Math.max(0, Math.floor(segundos));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
