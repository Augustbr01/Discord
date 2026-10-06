import { Loader2 } from "lucide-react";
import type { Canal, Usuario } from "../../api";
import type { MapaMembros, Voz } from "../../tipos";
import { Palco } from "./Palco";
import { Assento, Roda } from "./Roda";

type Props = {
    canal: Canal;
    eu: Usuario;
    membros: MapaMembros;
    voz: Voz | null;
    pessoas: Usuario[];
    entrando: boolean;
    onEntrar: () => void;
    onSair: () => void;
};

function quantasPessoas(n: number) {
    if (n === 0) return "Ninguém na sala agora";
    return n === 1 ? "1 pessoa na sala" : `${n} pessoas na sala`;
}

// tela de uma sala de voz: a chamada, se você estiver nela; senão, a roda de quem está lá e o botão de entrar
export function VistaVoz({ canal, eu, membros, voz, pessoas, entrando, onEntrar, onSair }: Props) {
    if (voz?.canal.id === canal.id) {
        return <Palco voz={voz} eu={eu} membros={membros} onSair={onSair} />;
    }

    return (
        <div className="voz-fora">
                <Roda
                    quantidade={pessoas.length}
                    centro={
                        <>
                            <h2 className="roda-titulo">{canal.nome}</h2>
                            <p className="roda-meta">{quantasPessoas(pessoas.length)}</p>
                            <button className="botao botao-primario botao-grande roda-entrar" onClick={onEntrar} disabled={entrando}>
                                {entrando && <Loader2 size={18} className="girar" />}
                                {entrando ? "Conectando…" : voz ? "Trocar de sala" : "Entrar na sala"}
                            </button>
                            {voz && !entrando && <small className="roda-nota">Você vai sair de {voz.canal.nome}.</small>}
                        </>
                    }
                >
                    {pessoas.map((p, i) => (
                        <Assento key={p.id} indice={i} nome={p.nome} url={p.avatarUrl} />
                    ))}
                </Roda>
        </div>
    );
}
