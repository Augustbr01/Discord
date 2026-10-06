import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, Hash, SendHorizontal } from "lucide-react";
import { LIMITE_MENSAGEM, type Canal, type Usuario } from "../api";
import { useMensagens, type MensagemLocal } from "../hooks/useMensagens";
import { estiloMatiz, hora, mesmoDia, partesTexto, quando, rotuloDia } from "../lib/util";
import { Avatar } from "./ui/Avatar";

// mensagens seguidas da mesma pessoa em até 7 min ficam no mesmo bloco
const JANELA_GRUPO_MS = 7 * 60 * 1000;

type Props = {
    canal: Canal;
    eu: Usuario;
};

type Item = {
    chave: string;
    autor: Usuario;
    conteudo: string;
    criadoEm: string;
    editada: boolean;
    local?: MensagemLocal;
};

export function CanalTexto({ canal, eu }: Props) {
    const { estado, mensagens, pendentes, enviar, reenviar, descartar } = useMensagens(canal.id, eu);

    const listaRef = useRef<HTMLDivElement>(null);
    const noFimRef = useRef(true);
    const [novas, setNovas] = useState(false);

    const itens: Item[] = [
        ...mensagens.map((m) => ({
            chave: m.id,
            autor: m.autor,
            conteudo: m.conteudo,
            criadoEm: m.criadoEm,
            editada: !!m.editadaEm,
        })),
        // se a atualização automática já trouxe a mensagem antes do envio terminar, não mostra duas vezes
        ...pendentes.filter((p) => !mensagens.some((m) =>
            m.autor.id === p.autor.id &&
            m.conteudo === p.conteudo &&
            new Date(m.criadoEm).getTime() >= new Date(p.criadoEm).getTime() - 10_000,
        )).map((p) => ({
            chave: p.idLocal,
            autor: p.autor,
            conteudo: p.conteudo,
            criadoEm: p.criadoEm,
            editada: false,
            local: p,
        })),
    ];

    // chegou mensagem: se você estava no fim, desce junto; se estava lendo acima, avisa
    useLayoutEffect(() => {
        const el = listaRef.current;
        if (!el) return;
        if (noFimRef.current) {
            el.scrollTop = el.scrollHeight;
        } else if (itens.length > 0) {
            setNovas(true);
        }
    }, [itens.length]);

    function aoRolar() {
        const el = listaRef.current;
        if (!el) return;
        noFimRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        if (noFimRef.current) setNovas(false);
    }

    function irProFim() {
        const el = listaRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        setNovas(false);
    }

    function aoEnviar(conteudo: string) {
        noFimRef.current = true;
        enviar(conteudo);
    }

    const indisponivel = estado === "indisponivel";

    return (
        <div className="vista">
            <div className="chat">
                <div className="chat-rolagem" ref={listaRef} onScroll={aoRolar}>
                    <div className="chat-conteudo">
                        <div className="chat-inicio">
                            <span className="chat-inicio-icone"><Hash size={30} /></span>
                            <h2>Bem-vindo a #{canal.nome}</h2>
                            <p>Este é o começo do canal #{canal.nome}.</p>
                        </div>

                        {estado === "carregando" && <EsqueletoMensagens />}

                        {estado === "indisponivel" && (
                            <div className="chat-aviso">
                                <strong>O chat de texto ainda não está disponível</strong>
                                <span>
                                    O servidor ainda não tem as rotas de mensagem. Assim que elas existirem, as conversas
                                    deste canal aparecem aqui. As salas de voz já têm um chat ao vivo.
                                </span>
                            </div>
                        )}

                        {estado === "erro" && (
                            <div className="chat-aviso">
                                <strong>Não foi possível carregar as mensagens</strong>
                                <span>Tentando de novo em alguns segundos…</span>
                            </div>
                        )}

                        {itens.map((item, i) => {
                            const anterior = itens[i - 1];
                            const data = new Date(item.criadoEm);
                            const dataAnterior = anterior ? new Date(anterior.criadoEm) : null;
                            const novoDia = !dataAnterior || !mesmoDia(dataAnterior, data);
                            const inicioGrupo =
                                novoDia ||
                                anterior.autor.id !== item.autor.id ||
                                data.getTime() - (dataAnterior?.getTime() ?? 0) > JANELA_GRUPO_MS;

                            return (
                                <Fragment key={item.chave}>
                                    {novoDia && (
                                        <div className="divisor-dia" role="separator">
                                            <span>{rotuloDia(data)}</span>
                                        </div>
                                    )}
                                    <article
                                        className={`mensagem ${inicioGrupo ? "mensagem-inicio" : ""} ${item.local ? `mensagem-${item.local.estado}` : ""}`}
                                    >
                                        <div className="mensagem-lateral">
                                            {inicioGrupo ? (
                                                <Avatar nome={item.autor.nome} url={item.autor.avatarUrl} tamanho={38} />
                                            ) : (
                                                <time className="mensagem-hora">{hora(data)}</time>
                                            )}
                                        </div>
                                        <div className="mensagem-corpo">
                                            {inicioGrupo && (
                                                <header className="mensagem-topo">
                                                    <strong className="nome-pessoa" style={estiloMatiz(item.autor.nome)}>{item.autor.nome}</strong>
                                                    <time dateTime={item.criadoEm}>{quando(data)}</time>
                                                </header>
                                            )}
                                            <p className="mensagem-texto">
                                                <Texto conteudo={item.conteudo} />
                                                {item.editada && <span className="mensagem-editada"> (editada)</span>}
                                            </p>
                                            {item.local?.estado === "falhou" && (
                                                <div className="mensagem-erro">
                                                    Não foi enviada.
                                                    <button onClick={() => reenviar(item.chave)}>Tentar de novo</button>
                                                    <button onClick={() => descartar(item.chave)}>Descartar</button>
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                </Fragment>
                            );
                        })}
                    </div>
                </div>

                {novas && (
                    <button className="chat-novas" onClick={irProFim}>
                        Novas mensagens <ArrowDown size={15} />
                    </button>
                )}

                <Compositor canalNome={canal.nome} desativado={indisponivel} onEnviar={aoEnviar} />
            </div>
        </div>
    );
}

// texto da mensagem com os links clicáveis
function Texto({ conteudo }: { conteudo: string }) {
    return (
        <>
            {partesTexto(conteudo).map((parte, i) =>
                parte.link ? (
                    <a key={i} href={parte.valor} target="_blank" rel="noreferrer noopener">{parte.valor}</a>
                ) : (
                    <Fragment key={i}>{parte.valor}</Fragment>
                ),
            )}
        </>
    );
}

type CompositorProps = { canalNome: string; desativado: boolean; onEnviar: (conteudo: string) => void };

function Compositor({ canalNome, desativado, onEnviar }: CompositorProps) {
    const [texto, setTexto] = useState("");
    const ref = useRef<HTMLTextAreaElement>(null);
    const restante = LIMITE_MENSAGEM - texto.length;

    // cresce conforme o texto, até um limite
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "0px";
        el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
        // só mostra a barra de rolagem quando passar da altura máxima
        el.style.overflowY = el.scrollHeight > 220 ? "auto" : "hidden";
    }, [texto]);

    function enviar() {
        const conteudo = texto.trim();
        if (!conteudo || desativado) return;
        onEnviar(conteudo);
        setTexto("");
        ref.current?.focus();
    }

    function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
        // Enter envia, Shift+Enter quebra a linha
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            enviar();
        }
    }

    return (
        <div className="compositor-area">
            <div className={`compositor ${desativado ? "desativado" : ""}`}>
                <textarea
                    ref={ref}
                    rows={1}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={aoTeclar}
                    maxLength={LIMITE_MENSAGEM}
                    placeholder={desativado ? "Chat de texto indisponível" : `Conversar em #${canalNome}`}
                    disabled={desativado}
                    autoFocus
                />
                {restante <= 40 && <span className={`compositor-limite ${restante <= 10 ? "quase" : ""}`}>{restante}</span>}
                <button className="compositor-enviar" onClick={enviar} disabled={desativado || !texto.trim()} aria-label="Enviar">
                    <SendHorizontal size={18} />
                </button>
            </div>
        </div>
    );
}

function EsqueletoMensagens() {
    return (
        <div className="esqueleto-mensagens" aria-hidden="true">
            {[68, 42, 80].map((largura, i) => (
                <div key={i} className="esqueleto-mensagem">
                    <span className="esqueleto esqueleto-avatar" />
                    <div>
                        <span className="esqueleto" style={{ width: 120, height: 12 }} />
                        <span className="esqueleto" style={{ width: `${largura}%`, height: 12 }} />
                    </div>
                </div>
            ))}
        </div>
    );
}
