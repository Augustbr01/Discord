import { useState, type FormEvent } from "react";
import { ListPlus, Pause, Play, SkipForward, Square, Trash2, X } from "lucide-react";
import type { Usuario } from "../../api";
import { useYoutubeSala } from "../../contexto/YoutubeSala";
import { useAgora } from "../../hooks/useAgora";
import { extrairIdYoutube, tempoVideo } from "../../lib/youtube";
import type { MapaMembros } from "../../tipos";
import { Dica } from "../ui/Dica";

const capa = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

// tocar/pausar, barra de tempo e pular. Qualquer um da call mexe e muda pra todo mundo
export function ControlesYoutube({ compacto = false }: { compacto?: boolean }) {
    const { estado, enviar, posicaoAgora } = useYoutubeSala();
    useAgora(500);
    // enquanto arrasta a barra, mostra onde você está soltando (só manda ao soltar)
    const [arrastando, setArrastando] = useState<number | null>(null);

    const video = estado?.video;
    if (!estado || !video) return null;

    const duracao = video.duracao ?? 0;
    const posicao = arrastando ?? posicaoAgora();
    const soltar = () => {
        if (arrastando !== null) enviar({ acao: "PULAR_PARA", segundos: arrastando });
        setArrastando(null);
    };

    return (
        <div className={`youtube-controles ${compacto ? "compacto" : ""}`}>
            <button
                className="botao-icone"
                onClick={() => enviar({ acao: estado.tocando ? "PAUSE" : "PLAY" })}
                aria-label={estado.tocando ? "Pausar para todos" : "Continuar para todos"}
            >
                {estado.tocando ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <input
                type="range"
                className="youtube-barra"
                min={0}
                max={Math.max(duracao, 1)}
                step={1}
                value={Math.min(posicao, Math.max(duracao, 1))}
                disabled={!duracao}
                onChange={(e) => setArrastando(Number(e.target.value))}
                onPointerUp={soltar}
                onKeyUp={soltar}
                aria-label="Posição do vídeo"
            />
            <span className="youtube-tempo">
                {tempoVideo(posicao)}{duracao ? ` / ${tempoVideo(duracao)}` : ""}
            </span>
            <Dica texto={estado.fila.length > 0 ? "Próximo da fila" : "Encerrar vídeo"}>
                <button className="botao-icone" onClick={() => enviar({ acao: "PROXIMO" })} aria-label="Próximo">
                    <SkipForward size={18} />
                </button>
            </Dica>
        </div>
    );
}

type Props = { membros: MapaMembros; eu: Usuario; onFechar: () => void; embutido?: boolean };

// painel "Assistir junto": colar link, o que está tocando e a fila
export function PainelYoutube({ membros, eu, onFechar, embutido = false }: Props) {
    const { estado, enviar } = useYoutubeSala();
    const [link, setLink] = useState("");
    const [invalido, setInvalido] = useState(false);

    const videoId = extrairIdYoutube(link);
    const nome = (id: string) => (id === eu.id ? "você" : membros.get(id)?.nome ?? "alguém");

    function mandar(acao: "TOCAR_AGORA" | "FILA") {
        if (!videoId) {
            setInvalido(true);
            return;
        }
        enviar({ acao, videoId });
        setLink("");
        setInvalido(false);
    }

    function submeter(e: FormEvent) {
        e.preventDefault();
        // Enter: se já tem algo tocando, vai pra fila em vez de cortar o vídeo dos outros
        mandar(estado?.video ? "FILA" : "TOCAR_AGORA");
    }

    const video = estado?.video;

    const corpo = (
        <div className="youtube-corpo">
            <form className="youtube-link" onSubmit={submeter}>
                <input
                    className="campo"
                    value={link}
                    onChange={(e) => {
                        setLink(e.target.value);
                        setInvalido(false);
                    }}
                    placeholder="Cole um link do YouTube"
                    autoFocus
                />
                {invalido && <span className="texto-erro">Esse link não parece ser de um vídeo do YouTube.</span>}
                <div className="youtube-link-acoes">
                    <button type="button" className="botao botao-pequeno botao-primario" disabled={!link.trim()} onClick={() => mandar("TOCAR_AGORA")}>
                        <Play size={15} /> Tocar agora
                    </button>
                    <button type="button" className="botao botao-pequeno botao-fantasma" disabled={!link.trim()} onClick={() => mandar("FILA")}>
                        <ListPlus size={15} /> Pôr na fila
                    </button>
                </div>
            </form>

            {estado === null ? (
                <p className="chat-sala-vazio">Carregando…</p>
            ) : video ? (
                <section className="youtube-atual">
                    <span className="rotulo">Tocando agora</span>
                    <div className="youtube-item">
                        <img src={capa(video.videoId)} alt="" />
                        <div>
                            <strong>{video.titulo}</strong>
                            <span>por {nome(video.por)}</span>
                        </div>
                    </div>
                    <ControlesYoutube />
                    {estado.ultima && estado.ultima.acao !== "TERMINOU" && (
                        <small className="texto-fraco">
                            {textoAcao(estado.ultima.acao)} por {nome(estado.ultima.usuarioId)}
                        </small>
                    )}
                </section>
            ) : (
                <p className="youtube-vazio">Nada tocando. Cole um link aí em cima e todo mundo da call assiste junto, no mesmo ponto do vídeo.</p>
            )}

            {estado && estado.fila.length > 0 && (
                <section className="youtube-fila">
                    <span className="rotulo">A seguir ({estado.fila.length})</span>
                    <ul>
                        {estado.fila.map((item) => (
                            <li key={item.id} className="youtube-item">
                                <img src={capa(item.videoId)} alt="" />
                                <div>
                                    <strong>{item.titulo}</strong>
                                    <span>por {nome(item.por)}</span>
                                </div>
                                <button className="botao-icone botao-icone-mini" onClick={() => enviar({ acao: "REMOVER", itemId: item.id })} aria-label="Tirar da fila">
                                    <Trash2 size={15} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {video && (
                <button className="botao botao-pequeno botao-fantasma youtube-parar" onClick={() => enviar({ acao: "PARAR" })}>
                    <Square size={14} /> Parar e limpar a fila
                </button>
            )}
        </div>
    );

    // dentro do controle da sala (aba YouTube) vai só o conteúdo, sem o cabeçalho próprio
    if (embutido) return corpo;

    return (
        <aside className="chat-sala youtube-painel">
            <header className="chat-sala-topo">
                <div>
                    <strong>Assistir junto</strong>
                    <span>Todo mundo na call controla</span>
                </div>
                <button className="botao-icone" onClick={onFechar} aria-label="Fechar">
                    <X size={18} />
                </button>
            </header>

            {corpo}
        </aside>
    );
}

function textoAcao(acao: string) {
    const textos: Record<string, string> = {
        TOCAR_AGORA: "Colocado",
        FILA: "Vídeo posto na fila",
        PLAY: "Continuado",
        PAUSE: "Pausado",
        PULAR_PARA: "Avançado",
        PROXIMO: "Pulado",
        REMOVER: "Vídeo tirado da fila",
    };
    return textos[acao] ?? "Mudado";
}
