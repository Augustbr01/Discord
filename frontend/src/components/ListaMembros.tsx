import { Crown, Volume2 } from "lucide-react";
import type { Membro, ServidorDetalhe, Usuario } from "../api";
import { usePerfil } from "../contexto/Perfil";
import { Avatar } from "./ui/Avatar";
import { Dica } from "./ui/Dica";

type Props = {
    servidor: ServidorDetalhe;
    eu: Usuario;
    // id do usuário -> nome da sala em que está
    emChamada: Map<string, string>;
};

// coluna da direita: quem faz parte do servidor
export function ListaMembros({ servidor, eu, emChamada }: Props) {
    const admins = servidor.membros.filter((m) => m.permissao === "ADMIN");
    const membros = servidor.membros.filter((m) => m.permissao !== "ADMIN");

    return (
        <aside className="lista-membros" aria-label="Membros">
            <Grupo titulo="Admins" membros={admins} donoId={servidor.dono.id} eu={eu} emChamada={emChamada} />
            <Grupo titulo="Membros" membros={membros} donoId={servidor.dono.id} eu={eu} emChamada={emChamada} />
        </aside>
    );
}

type GrupoProps = { titulo: string; membros: Membro[]; donoId: string; eu: Usuario; emChamada: Map<string, string> };

function Grupo({ titulo, membros, donoId, eu, emChamada }: GrupoProps) {
    const { abrirPerfil } = usePerfil();
    if (membros.length === 0) return null;

    return (
        <section className="membros-grupo">
            <span className="rotulo">{titulo}</span>
            {membros.map(({ usuario }) => {
                const sala = emChamada.get(usuario.id);
                return (
                    <button
                        key={usuario.id}
                        className="membro"
                        onClick={(e) => abrirPerfil(usuario, e.currentTarget)}
                        aria-haspopup="dialog"
                    >
                        <Avatar nome={usuario.nome} url={usuario.avatarUrl} tamanho={32} />
                        <div className="membro-texto">
                            <span className="membro-nome">
                                <span className="truncar">{usuario.nome}</span>
                                {usuario.id === donoId && (
                                    <Dica texto="Dono do servidor">
                                        <Crown size={14} className="membro-coroa" aria-label="Dono do servidor" />
                                    </Dica>
                                )}
                            </span>
                            {sala ? (
                                <span className="membro-status">
                                    <Volume2 size={12} /> <span className="truncar">{sala}</span>
                                </span>
                            ) : (
                                usuario.id === eu.id && <span className="membro-status">Você</span>
                            )}
                        </div>
                    </button>
                );
            })}
        </section>
    );
}
