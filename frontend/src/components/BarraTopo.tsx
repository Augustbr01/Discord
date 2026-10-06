import { useCallback, useRef, useState } from "react";
import { Bird, Building2, Headphones, HeadphoneOff, LogOut, Mic, MicOff, Plus, Search, Volume2 } from "lucide-react";
import type { ServidorResumo, Usuario } from "../api";
import { useControleVoz } from "../contexto/ControleVoz";
import { useCliqueFora } from "../hooks/useCliqueFora";
import { teclaAtalho } from "../lib/util";
import type { MapaMembros, Voz } from "../tipos";
import { IlhaChamada } from "./chamada/IlhaChamada";
import { Avatar, IconeServidor } from "./ui/Avatar";
import { Dica } from "./ui/Dica";

type Props = {
    servidores: ServidorResumo[];
    carregando: boolean;
    atualId: string | null;
    eu: Usuario;
    voz: Voz | null;
    membros: MapaMembros;
    // você está olhando o palco da chamada agora
    noPalco: boolean;
    // andando pelo prédio em 3D
    modo3d: boolean;
    onAlternar3D: () => void;
    onEscolher: (id: string) => void;
    onAdicionar: () => void;
    onBuscar: () => void;
    onAbrirChamada: () => void;
    onSairChamada: () => void;
    onSairConta: () => void;
};

// topo: os servidores como abas (a aberta se funde com a folha), a ilha da chamada e você
export function BarraTopo(props: Props) {
    const { servidores, carregando, atualId, eu, voz } = props;

    return (
        <header className="topo">
            <span className="topo-marca" aria-hidden="true">
                <Bird size={22} strokeWidth={1.9} />
            </span>

            <nav className="abas-servidores" aria-label="Servidores">
                {carregando && servidores.length === 0 && (
                    <span className="aba-servidor aba-esqueleto" aria-hidden="true">
                        <span className="esqueleto" style={{ width: 120 }} />
                    </span>
                )}

                {servidores.map((s) => {
                    const ativa = s.id === atualId;
                    return (
                        <button
                            key={s.id}
                            className={`aba-servidor ${ativa ? "ativa" : ""}`}
                            onClick={() => props.onEscolher(s.id)}
                            aria-current={ativa ? "page" : undefined}
                            title={s.nome}
                        >
                            <IconeServidor nome={s.nome} url={s.iconeUrl} tamanho={24} />
                            <span className="aba-servidor-nome truncar">{s.nome}</span>
                            {voz?.servidorId === s.id && (
                                <Volume2 size={14} className="aba-em-chamada" aria-label="Você está numa sala deste servidor" />
                            )}
                        </button>
                    );
                })}

                <Dica texto="Adicionar servidor" lado="baixo">
                    <button className="aba-adicionar" onClick={props.onAdicionar} aria-label="Adicionar servidor">
                        <Plus size={18} />
                    </button>
                </Dica>
            </nav>

            {voz && (
                <IlhaChamada
                    voz={voz}
                    eu={eu}
                    membros={props.membros}
                    noPalco={props.noPalco}
                    onAbrir={props.onAbrirChamada}
                    onSair={props.onSairChamada}
                />
            )}

            <div className="topo-voce">
                <Dica texto={props.modo3d ? "Voltar pra vista normal" : "Andar pelo prédio em 3D"} lado="baixo">
                    <button
                        className={`botao-predio ${props.modo3d ? "ativo" : ""}`}
                        onClick={props.onAlternar3D}
                        aria-pressed={props.modo3d}
                    >
                        <Building2 size={16} />
                        <span>Prédio</span>
                    </button>
                </Dica>
                <Dica texto={`Buscar (${teclaAtalho} K)`} lado="baixo">
                    <button className="botao-icone topo-buscar" onClick={props.onBuscar} aria-label="Buscar">
                        <Search size={19} />
                    </button>
                </Dica>
                <ControlesVoce />
                <MenuVoce eu={eu} salaAtual={voz?.canal.nome ?? null} onSair={props.onSairConta} />
            </div>
        </header>
    );
}

// microfone e áudio: dentro da chamada agem na hora, fora dela viram preferência
function ControlesVoce() {
    const { micLigado, micPendente, alternarMic, surdo, alternarSurdo } = useControleVoz();

    return (
        <>
            <Dica texto={micLigado ? "Desativar microfone" : "Ativar microfone"} lado="baixo">
                <button
                    className={`botao-icone ${micLigado ? "" : "botao-icone-desligado"}`}
                    onClick={alternarMic}
                    disabled={micPendente}
                    aria-pressed={!micLigado}
                    aria-label={micLigado ? "Desativar microfone" : "Ativar microfone"}
                >
                    {micLigado ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
            </Dica>
            <Dica texto={surdo ? "Ativar áudio" : "Desativar áudio"} lado="baixo">
                <button
                    className={`botao-icone ${surdo ? "botao-icone-desligado" : ""}`}
                    onClick={alternarSurdo}
                    aria-pressed={surdo}
                    aria-label={surdo ? "Ativar áudio" : "Desativar áudio"}
                >
                    {surdo ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
                </button>
            </Dica>
        </>
    );
}

function MenuVoce({ eu, salaAtual, onSair }: { eu: Usuario; salaAtual: string | null; onSair: () => void }) {
    const [aberto, setAberto] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const fechar = useCallback(() => setAberto(false), []);
    useCliqueFora(ref, aberto, fechar);

    return (
        <div className="menu-ancora" ref={ref}>
            <button
                className={`topo-avatar ${aberto ? "aberto" : ""}`}
                onClick={() => setAberto((v) => !v)}
                aria-label="Sua conta"
                aria-haspopup="menu"
                aria-expanded={aberto}
            >
                <Avatar nome={eu.nome} url={eu.avatarUrl} tamanho={32} />
            </button>

            {aberto && (
                <div className="menu menu-voce" role="menu">
                    <div className="menu-voce-cartao">
                        <Avatar nome={eu.nome} url={eu.avatarUrl} tamanho={40} />
                        <span>
                            <strong className="truncar">{eu.nome}</strong>
                            <span className="truncar">{salaAtual ? `Em ${salaAtual}` : "Fora de chamada"}</span>
                        </span>
                    </div>
                    <span className="menu-separador" />
                    <button role="menuitem" className="menu-item menu-item-perigo" onClick={onSair}>
                        Sair da conta <LogOut size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
