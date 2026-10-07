import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Play, Volume2 } from "lucide-react";
import { carregarApiYoutube, ESTADO_YT, type PlayerYT } from "../../lib/youtube";
import type { ComandoYoutube, EstadoYoutube } from "../../tipos";

// diferença aceitável entre o seu player e o da sala antes de pular pro lugar certo
const TOLERANCIA_S = 1.5;

type Props = {
    estado: EstadoYoutube;
    posicaoAgora: () => number;
    enviar: (comando: ComandoYoutube) => void;
    // 0..100, lido a cada segundo (no 3D fica mais baixo longe da TV)
    volume?: RefObject<number>;
    mudo: boolean;
    // clicar no vídeo pausa/continua pra todo mundo (no 3D não tem clique: é pela TV)
    clicavel?: boolean;
};

// O player do YouTube de cada um, seguindo o estado da sala: carrega o vídeo,
// toca/pausa e corrige a posição quando escorrega. Os controles do próprio YouTube
// ficam desligados: quem controla é a sala (pelos botões da gente)
export function PlayerYoutube({ estado, posicaoAgora, enviar, volume, mudo, clicavel = true }: Props) {
    const caixa = useRef<HTMLDivElement>(null);
    const player = useRef<PlayerYT | null>(null);
    const carregado = useRef<string | null>(null);
    const tentativas = useRef(0);
    const [pronto, setPronto] = useState(false);
    const [semSom, setSemSom] = useState(false);
    const [erro, setErro] = useState(false);

    const atual = useRef({ estado, posicaoAgora, enviar, volume, mudo, semSom });
    atual.current = { estado, posicaoAgora, enviar, volume, mudo, semSom };

    useEffect(() => {
        let ativo = true;
        let p: PlayerYT | null = null;
        carregarApiYoutube()
            .then((YT) => {
                if (!ativo || !caixa.current) return;
                const alvo = document.createElement("div");
                caixa.current.append(alvo);
                p = new YT.Player(alvo, {
                    width: "100%",
                    height: "100%",
                    playerVars: { controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1 },
                    events: {
                        onReady: () => {
                            if (!ativo) return;
                            player.current = p;
                            setPronto(true);
                        },
                        onStateChange: ({ data }) => {
                            const { estado: e, enviar: mandar } = atual.current;
                            const video = e.video;
                            if (!video || carregado.current !== video.videoId || !p) return;
                            if (data === ESTADO_YT.TOCANDO) {
                                tentativas.current = 0;
                                setErro(false);
                                // o primeiro que descobrir a duração conta pra todo mundo
                                const duracao = p.getDuration();
                                if (video.duracao === null && duracao > 0) mandar({ acao: "DURACAO", videoId: video.videoId, segundos: Math.round(duracao) });
                            }
                            if (data === ESTADO_YT.TERMINOU) mandar({ acao: "TERMINOU", videoId: video.videoId });
                        },
                        onError: () => setErro(true),
                    },
                });
            })
            .catch(() => setErro(true));

        return () => {
            ativo = false;
            p?.destroy();
            player.current = null;
            carregado.current = null;
        };
    }, []);

    const sincronizar = useCallback(() => {
        const p = player.current;
        const { estado: e, posicaoAgora: pos, volume: vol, mudo: m, semSom: travado } = atual.current;
        if (!p || !e.video) return;
        const alvo = pos();

        if (carregado.current !== e.video.videoId) {
            carregado.current = e.video.videoId;
            tentativas.current = 0;
            setErro(false);
            if (e.tocando) p.loadVideoById({ videoId: e.video.videoId, startSeconds: alvo });
            else p.cueVideoById({ videoId: e.video.videoId, startSeconds: alvo });
            return;
        }

        const situacao = p.getPlayerState();
        if (e.tocando) {
            if (situacao !== ESTADO_YT.TOCANDO && situacao !== ESTADO_YT.CARREGANDO && situacao !== ESTADO_YT.TERMINOU) {
                tentativas.current++;
                // pediu pra tocar várias vezes e nada: o navegador bloqueou o som automático.
                // Toca mudo e libera o som no próximo clique/tecla
                if (tentativas.current >= 3 && !p.isMuted()) {
                    p.mute();
                    setSemSom(true);
                }
                p.playVideo();
            }
        } else if (situacao === ESTADO_YT.TOCANDO || situacao === ESTADO_YT.CARREGANDO) {
            p.pauseVideo();
        }

        // seekTo com o vídeo só "carregado" faria ele começar a tocar: só corrige tocando ou pausado
        if ((situacao === ESTADO_YT.TOCANDO || situacao === ESTADO_YT.PAUSADO) && Math.abs(p.getCurrentTime() - alvo) > TOLERANCIA_S) {
            p.seekTo(alvo, true);
        }

        p.setVolume(Math.round(vol?.current ?? 100));
        if (m || travado) {
            if (!p.isMuted()) p.mute();
        } else if (p.isMuted()) {
            p.unMute();
        }
    }, []);

    useEffect(() => {
        if (!pronto) return;
        const t = window.setInterval(sincronizar, 1000);
        return () => window.clearInterval(t);
    }, [pronto, sincronizar]);

    // mudou o estado (alguém pausou, pulou, trocou o vídeo): acerta na hora
    useEffect(() => {
        if (pronto) sincronizar();
    }, [pronto, estado, mudo, sincronizar]);

    // som bloqueado: qualquer clique ou tecla na página libera
    useEffect(() => {
        if (!semSom) return;
        const liberar = () => {
            setSemSom(false);
            atual.current.semSom = false;
            player.current?.unMute();
            player.current?.playVideo();
        };
        window.addEventListener("pointerdown", liberar, { once: true });
        window.addEventListener("keydown", liberar, { once: true });
        return () => {
            window.removeEventListener("pointerdown", liberar);
            window.removeEventListener("keydown", liberar);
        };
    }, [semSom]);

    const alternar = () => enviar({ acao: estado.tocando ? "PAUSE" : "PLAY" });

    return (
        <div className="youtube-player">
            <div ref={caixa} className="youtube-player-video" />
            {clicavel && <button className="youtube-player-clique" onClick={alternar} aria-label={estado.tocando ? "Pausar para todos" : "Continuar para todos"} />}
            {!estado.tocando && !erro && (
                <span className="youtube-player-aviso">
                    <Play size={16} /> Pausado
                </span>
            )}
            {semSom && (
                <span className="youtube-player-aviso">
                    <Volume2 size={16} /> Clique para ativar o som
                </span>
            )}
            {erro && <span className="youtube-player-aviso">Esse vídeo não pode tocar aqui. Pule para o próximo.</span>}
        </div>
    );
}
