import { Loader2, Volume2 } from "lucide-react";
import type { Canal, Usuario } from "../../api";
import type { MapaMembros, Voz } from "../../tipos";
import { Avatar } from "../ui/Avatar";
import { Cabecalho } from "../ui/Cabecalho";
import { Palco } from "./Palco";

type Props = {
    canal: Canal;
    eu: Usuario;
    membros: MapaMembros;
    voz: Voz | null;
    pessoas: Usuario[];
    entrando: boolean;
    onEntrar: () => void;
    onSair: () => void;
    onMenu: () => void;
};

// tela de uma sala de voz: a chamada, se você estiver nela; senão, quem está lá e o botão de entrar
export function VistaVoz({ canal, eu, membros, voz, pessoas, entrando, onEntrar, onSair, onMenu }: Props) {
    if (voz?.canal.id === canal.id) {
        return <Palco voz={voz} eu={eu} membros={membros} onSair={onSair} onMenu={onMenu} />;
    }

    return (
        <div className="vista">
            <Cabecalho icone={<Volume2 size={20} />} titulo={canal.nome} onMenu={onMenu} />

            <div className="voz-fora">
                <div className="voz-fora-conteudo">
                    <span className="voz-fora-icone"><Volume2 size={28} /></span>
                    <h2>{canal.nome}</h2>

                    {pessoas.length > 0 ? (
                        <>
                            <p>Na sala agora:</p>
                            <ul className="voz-fora-pessoas">
                                {pessoas.map((p) => (
                                    <li key={p.id}>
                                        <Avatar nome={p.nome} url={p.avatarUrl} tamanho={24} />
                                        <span className="truncar">{p.nome}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p>Ninguém na sala agora.</p>
                    )}

                    <button className="botao botao-primario botao-grande" onClick={onEntrar} disabled={entrando}>
                        {entrando && <Loader2 size={18} className="girar" />}
                        {entrando ? "Conectando…" : voz ? "Trocar para esta sala" : "Entrar na sala"}
                    </button>

                    {voz && !entrando && <small>Você vai sair de {voz.canal.nome}.</small>}
                </div>
            </div>
        </div>
    );
}
