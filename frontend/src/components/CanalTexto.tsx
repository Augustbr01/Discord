import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDown, Hash, Search, SendHorizontal, Users } from "lucide-react";
import { LIMITE_MENSAGEM, type Canal, type Usuario } from "../api";
import { useDigitando } from "../hooks/useDigitando";
import { useMensagens, type MensagemLocal } from "../hooks/useMensagens";
import { hora, mesmoDia, partesTexto, quando, rotuloDia, teclaAtalho } from "../lib/util";
import type { MapaMembros } from "../tipos";
import { Avatar } from "./ui/Avatar";
import { Cabecalho } from "./ui/Cabecalho";
import { Dica } from "./ui/Dica";

// mensagens seguidas da mesma pessoa em até 7 min ficam no mesmo bloco
const JANELA_GRUPO_MS = 7 * 60 * 1000;

type Props = {
    canal: Canal;
    eu: Usuario;
    membros: MapaMembros;
    membrosVisivel: boolean;
    onMembros: () => void;
    onBuscar: () => void;
    onMenu: () => void;
};

type Item = {
    chave: string;
    autor: Usuario;
    conteudo: string;
    criadoEm: string;
    editada: boolean;
    local?: MensagemLocal;
};

export function CanalTexto({ canal, eu, membros, membrosVisivel, onMembros, onBuscar, onMenu }: Props) {
    const { estado, mensagens, pendentes, temMais, carregandoMais, enviar, reenviar, descartar, carregarMais } = useMensagens(canal.id, eu);
    const { nomes: digitando, notificar } = useDigitando(canal.id, eu, membros);

    const listaRef = useRef<HTMLDivElement>(null);
    const noFimRef = useRef(true);
    // altura da rolagem antes de prepender histórico, pra manter a leitura no lugar
    const preservarRef = useRef<number | null>(null);
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
        // acabamos de prepender histórico (rolar pra cima): mantém a posição de leitura
        if (preservarRef.current !== null) {
            el.scrollTop += el.scrollHeight - preservarRef.current;
            preservarRef.current = null;
            return;
        }
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
        // perto do topo: carrega mais antigas, guardando a altura pra preservar a posição
        if (el.scrollTop < 120 && temMais && !carregandoMais) {
            preservarRef.current = el.scrollHeight;
            carregarMais();
        }
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
            <Cabecalho icone={<Hash size={20} />} titulo={canal.nome} onMenu={onMenu}>
                <Dica texto={`Buscar (${teclaAtalho} K)`} lado="baixo">
                    <button className="botao-icone" onClick={onBuscar} aria-label="Buscar">
                        <Search size={19} />
                    </button>
                </Dica>
                <Dica texto={membrosVisivel ? "Ocultar membros" : "Mostrar membros"} lado="baixo">
                    <button
                        className={`botao-icone ${membrosVisivel ? "ativo" : ""}`}
                        onClick={onMembros}
                        aria-pressed={membrosVisivel}
                        aria-label="Membros"
                    >
                        <Users size={19} />
                    </button>
                </Dica>
            </Cabecalho>

            <div className="chat">
                <div className="chat-rolagem" ref={listaRef} onScroll={aoRolar}>
                    <div className="chat-conteudo">
                        {!temMais && (
                            <div className="chat-inicio">
                                <span className="chat-inicio-icone"><Hash size={30} /></span>
                                <h2>Bem-vindo a #{canal.nome}</h2>
                                <p>Este é o começo do canal #{canal.nome}.</p>
                            </div>
                        )}

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
                                                    <strong>{item.autor.nome}</strong>
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

                {digitando.length > 0 && (
                    <div className="chat-digitando" aria-live="polite">{textoDigitando(digitando)}</div>
                )}

                <Compositor canalNome={canal.nome} desativado={indisponivel} onEnviar={aoEnviar} onDigitar={notificar} />
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

// monta "Fulano está digitando…" conforme a quantidade de gente
function textoDigitando(nomes: string[]) {
    if (nomes.length === 1) return `${nomes[0]} está digitando…`;
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]} estão digitando…`;
    if (nomes.length === 3) return `${nomes[0]}, ${nomes[1]} e ${nomes[2]} estão digitando…`;
    return "Várias pessoas estão digitando…";
}

type CompositorProps = { canalNome: string; desativado: boolean; onEnviar: (conteudo: string) => void; onDigitar: () => void };

function Compositor({ canalNome, desativado, onEnviar, onDigitar }: CompositorProps) {
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
                    onChange={(e) => {
                        setTexto(e.target.value);
                        onDigitar();
                    }}
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
