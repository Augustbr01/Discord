import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ellipsis, Hash, Plus, Trash2, UserPlus, Volume2 } from "lucide-react";
import type { Canal, ServidorDetalhe, TipoCanal } from "../api";
import { useCliqueFora } from "../hooks/useCliqueFora";
import { Dica } from "./ui/Dica";

type Props = {
    servidor: ServidorDetalhe;
    canalAtual: Canal | null;
    souAdmin: boolean;
    // quantas pessoas estão nas salas de voz agora
    emChamada: number;
    onCanal: (canal: Canal) => void;
    onApagarCanal: (canal: Canal) => void;
    onConvidar: () => void;
    onNovoCanal: (tipo: TipoCanal) => void;
    onAbrirPraca: () => void;
};

// cabeçalho da folha: o servidor aberto e os canais de texto como pílulas
export function TopoServidor(props: Props) {
    const { servidor, canalAtual, souAdmin, emChamada } = props;
    const texto = servidor.canais.filter((c) => c.tipo === "TEXTO");
    const membros = servidor.membros.length;

    return (
        <div className="topo-servidor">
            <div className="topo-servidor-linha">
                <div className="servidor-titulo">
                    <h1 className="truncar">{servidor.nome}</h1>
                    <span className="servidor-meta truncar">
                        {membros === 1 ? "1 membro" : `${membros} membros`}
                        {emChamada > 0 && <> · <em>{emChamada} em chamada</em></>}
                    </span>
                </div>

                <div className="topo-servidor-acoes">
                    {/* em telas estreitas a Praça (salas e pessoas) fica escondida atrás deste botão */}
                    <button className="botao botao-pequeno botao-praca" onClick={props.onAbrirPraca}>
                        <Volume2 size={15} />
                        Salas
                        {emChamada > 0 && <span className="botao-praca-contagem">{emChamada}</span>}
                    </button>
                    {souAdmin && (
                        <button className="botao botao-pequeno botao-contorno botao-convidar" onClick={props.onConvidar}>
                            <UserPlus size={15} />
                            Convidar
                        </button>
                    )}
                    {souAdmin && <MenuServidor onConvidar={props.onConvidar} onNovoCanal={props.onNovoCanal} />}
                </div>
            </div>

            <nav className="abas-canais" aria-label="Canais de texto">
                {texto.map((c) => {
                    const ativo = canalAtual?.id === c.id;
                    return (
                        <span key={c.id} className={`pilula ${ativo ? "ativa" : ""}`}>
                            <button className="pilula-corpo" onClick={() => props.onCanal(c)} aria-current={ativo ? "page" : undefined}>
                                <Hash size={15} className="pilula-icone" />
                                {c.nome}
                            </button>
                            {ativo && souAdmin && <AcoesCanal canal={c} onApagar={props.onApagarCanal} />}
                        </span>
                    );
                })}

                {/* a sala de voz aberta no palco aparece como a pílula ativa */}
                {canalAtual?.tipo === "VOZ" && (
                    <span className="pilula ativa pilula-voz">
                        <span className="pilula-corpo">
                            <Volume2 size={15} className="pilula-icone" />
                            {canalAtual.nome}
                        </span>
                    </span>
                )}

                {souAdmin && (
                    <Dica texto="Criar canal de texto" lado="baixo">
                        <button className="pilula-adicionar" onClick={() => props.onNovoCanal("TEXTO")} aria-label="Criar canal de texto">
                            <Plus size={16} />
                        </button>
                    </Dica>
                )}
            </nav>
        </div>
    );
}

function MenuServidor({ onConvidar, onNovoCanal }: { onConvidar: () => void; onNovoCanal: (tipo: TipoCanal) => void }) {
    const [aberto, setAberto] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const fechar = useCallback(() => setAberto(false), []);
    useCliqueFora(ref, aberto, fechar);

    function executar(acao: () => void) {
        fechar();
        acao();
    }

    return (
        <div className="menu-ancora" ref={ref}>
            <Dica texto="Mais opções" lado="baixo">
                <button
                    className={`botao-icone ${aberto ? "ativo" : ""}`}
                    onClick={() => setAberto((v) => !v)}
                    aria-label="Mais opções do servidor"
                    aria-haspopup="menu"
                    aria-expanded={aberto}
                >
                    <Ellipsis size={18} />
                </button>
            </Dica>

            {aberto && (
                <div className="menu menu-servidor" role="menu">
                    <button role="menuitem" className="menu-item" onClick={() => executar(onConvidar)}>
                        Convidar pessoas <UserPlus size={16} />
                    </button>
                    <span className="menu-separador" />
                    <button role="menuitem" className="menu-item" onClick={() => executar(() => onNovoCanal("TEXTO"))}>
                        Criar canal de texto <Hash size={16} />
                    </button>
                    <button role="menuitem" className="menu-item" onClick={() => executar(() => onNovoCanal("VOZ"))}>
                        Criar sala de voz <Volume2 size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}

// "..." do canal (admin): apagar. O menu vai pro body com posição fixa porque as pílulas
// e a praça rolam, e um menu absoluto dentro delas seria cortado.
export function AcoesCanal({ canal, onApagar, className = "" }: { canal: Canal; onApagar: (c: Canal) => void; className?: string }) {
    const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const botaoRef = useRef<HTMLButtonElement>(null);
    const fechar = useCallback(() => setPosicao(null), []);
    useCliqueFora(ref, !!posicao, fechar);

    function alternar() {
        if (posicao) return fechar();
        const r = botaoRef.current?.getBoundingClientRect();
        if (!r) return;
        setPosicao({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 196)) });
    }

    return (
        <div className={`canal-acoes ${posicao ? "fixo" : ""} ${className}`} ref={ref}>
            <button
                ref={botaoRef}
                className="canal-acao"
                onClick={alternar}
                aria-label={`Opções do canal ${canal.nome}`}
                aria-haspopup="menu"
                aria-expanded={!!posicao}
            >
                <Ellipsis size={15} />
            </button>

            {posicao && createPortal(
                // o mousedown não sobe pro document, senão o "clique fora" fecharia antes do clique valer
                <div className="menu menu-canal" role="menu" style={{ position: "fixed", ...posicao }} onMouseDown={(e) => e.stopPropagation()}>
                    <button
                        role="menuitem"
                        className="menu-item menu-item-perigo"
                        onClick={() => {
                            fechar();
                            onApagar(canal);
                        }}
                    >
                        {canal.tipo === "VOZ" ? "Apagar sala" : "Apagar canal"} <Trash2 size={16} />
                    </button>
                </div>,
                document.body,
            )}
        </div>
    );
}
