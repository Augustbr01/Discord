import type { ReactNode } from "react";
import { useConnectionState, useParticipants } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Headphones, Loader2, Plus, X } from "lucide-react";
import type { Canal, ServidorDetalhe, Usuario } from "../api";
import { useControleVoz } from "../contexto/ControleVoz";
import type { MapaMembros, Voz } from "../tipos";
import { AssentoAoVivo, pessoaDoParticipante } from "./chamada/AoVivo";
import { Assento, Roda } from "./chamada/Roda";
import { ListaMembros } from "./ListaMembros";
import { AcoesCanal } from "./TopoServidor";

export type AbaPraca = "salas" | "pessoas";

// a mini-roda mostra no máximo isso de gente; o resto vira "+N" no texto
const ASSENTOS_MINI = 8;

type Props = {
    servidor: ServidorDetalhe;
    eu: Usuario;
    voz: Voz | null;
    membros: MapaMembros;
    entrandoEm: string | null;
    souAdmin: boolean;
    // id do usuário -> nome da sala em que está
    emChamada: Map<string, string>;
    aba: AbaPraca;
    onAba: (aba: AbaPraca) => void;
    onCanal: (canal: Canal) => void;
    onApagarCanal: (canal: Canal) => void;
    onNovaSala: () => void;
    onFechar: () => void;
};

// a Praça: as salas de voz do servidor como rodas (dá pra ver quem está onde sem entrar) e as pessoas
export function Praca(props: Props) {
    const { servidor, aba } = props;
    const salas = servidor.canais.filter((c) => c.tipo === "VOZ");

    return (
        <aside className="praca" aria-label="Salas de voz e pessoas">
            <div className="praca-topo">
                <div className="segmentado" role="tablist">
                    <button role="tab" aria-selected={aba === "salas"} className={aba === "salas" ? "ativa" : ""} onClick={() => props.onAba("salas")}>
                        Salas de voz
                    </button>
                    <button role="tab" aria-selected={aba === "pessoas"} className={aba === "pessoas" ? "ativa" : ""} onClick={() => props.onAba("pessoas")}>
                        Pessoas <span className="segmentado-contagem">{servidor.membros.length}</span>
                    </button>
                </div>
                <button className="botao-icone praca-fechar" onClick={props.onFechar} aria-label="Fechar">
                    <X size={18} />
                </button>
            </div>

            <div className="praca-conteudo">
                {aba === "salas" ? (
                    <div className="praca-salas">
                        {salas.map((c) => (
                            <CartaoSala
                                key={c.id}
                                canal={c}
                                conectado={props.voz?.canal.id === c.id}
                                entrando={props.entrandoEm === c.id}
                                souAdmin={props.souAdmin}
                                membros={props.membros}
                                eu={props.eu}
                                onAbrir={() => props.onCanal(c)}
                                onApagar={props.onApagarCanal}
                            />
                        ))}

                        {salas.length === 0 && !props.souAdmin && (
                            <p className="praca-vazia">Este servidor ainda não tem salas de voz.</p>
                        )}

                        {props.souAdmin && (
                            <button className="cartao-nova-sala" onClick={props.onNovaSala}>
                                <Plus size={16} /> Nova sala de voz
                            </button>
                        )}
                    </div>
                ) : (
                    <ListaMembros servidor={servidor} eu={props.eu} emChamada={props.emChamada} />
                )}
            </div>
        </aside>
    );
}

type CartaoProps = {
    canal: Canal;
    conectado: boolean;
    entrando: boolean;
    souAdmin: boolean;
    membros: MapaMembros;
    eu: Usuario;
    onAbrir: () => void;
    onApagar: (canal: Canal) => void;
};

function CartaoSala(props: CartaoProps) {
    const { canal, conectado, entrando, souAdmin } = props;

    return (
        <div className={`cartao-sala ${conectado ? "conectado" : ""}`}>
            {conectado ? (
                <CorpoAoVivo {...props} />
            ) : (
                <CorpoSala canal={canal} entrando={entrando} pessoas={canal.participantes ?? []} onAbrir={props.onAbrir} />
            )}
            {souAdmin && <AcoesCanal canal={canal} onApagar={props.onApagar} className="cartao-sala-acoes" />}
        </div>
    );
}

// sala em que você não está: quem o servidor diz que está lá
function CorpoSala({ canal, entrando, pessoas, onAbrir }: { canal: Canal; entrando: boolean; pessoas: Usuario[]; onAbrir: () => void }) {
    const n = pessoas.length;
    return (
        <>
            <MiniRoda quantidade={Math.min(n, ASSENTOS_MINI)} total={n}>
                {pessoas.slice(0, ASSENTOS_MINI).map((p, i) => (
                    <Assento key={p.id} indice={i} nome={p.nome} url={p.avatarUrl} />
                ))}
            </MiniRoda>
            <span className="cartao-sala-texto">
                {/* o botão cobre o cartão inteiro (::after), então qualquer lugar dele entra na sala */}
                <button className="cartao-sala-corpo truncar" onClick={onAbrir} aria-label={`Entrar em ${canal.nome}`}>
                    {canal.nome}
                </button>
                <span className="cartao-sala-quem">{n === 0 ? "Ninguém ainda" : resumoNomes(pessoas.map((p) => p.nome))}</span>
                <span className="cartao-sala-acao">
                    {entrando ? <><Loader2 size={13} className="girar" /> Conectando…</> : "Entrar"}
                </span>
            </span>
        </>
    );
}

// sala em que você está: direto do LiveKit, com quem está falando
function CorpoAoVivo({ canal, membros, eu, onAbrir }: CartaoProps) {
    const participantes = useParticipants();
    const estado = useConnectionState();
    const { surdo } = useControleVoz();
    const nomes = participantes.map((p) => pessoaDoParticipante(p, membros, eu).nome);

    return (
        <>
            <MiniRoda quantidade={Math.min(participantes.length, ASSENTOS_MINI)} total={participantes.length}>
                {participantes.slice(0, ASSENTOS_MINI).map((p, i) => (
                    <AssentoAoVivo key={p.identity} indice={i} participante={p} membros={membros} eu={eu} surdo={p.isLocal && surdo} />
                ))}
            </MiniRoda>
            <span className="cartao-sala-texto">
                <button className="cartao-sala-corpo truncar" onClick={onAbrir} aria-label={`Abrir a chamada em ${canal.nome}`}>
                    {canal.nome}
                </button>
                <span className="cartao-sala-quem">{resumoNomes(nomes)}</span>
                <span className="cartao-sala-acao">
                    {estado === ConnectionState.Connected ? "Você está aqui" : "Conectando…"}
                </span>
            </span>
        </>
    );
}

function MiniRoda({ quantidade, total, children }: { quantidade: number; total: number; children: ReactNode }) {
    return (
        <span className="cartao-sala-roda" aria-hidden="true">
            <Roda
                quantidade={quantidade}
                className="roda-mini"
                centro={total > 0 ? <span className="roda-mini-total numeros">{total}</span> : <Headphones size={18} />}
            >
                {children}
            </Roda>
        </span>
    );
}

// "bia, caio e duda" / "bia, caio e mais 3"
function resumoNomes(nomes: string[]) {
    if (nomes.length <= 3) {
        return nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
    }
    return `${nomes.slice(0, 2).join(", ")} e mais ${nomes.length - 2}`;
}
