import type { Membro, ServidorDetalhe } from "../api";
import { Avatar } from "./Avatar";
import { IconeCoroa } from "./Icones";

export function ListaMembros({ servidor }: { servidor: ServidorDetalhe }) {
    const admins = servidor.membros.filter((m) => m.permissao === "ADMIN");
    const membros = servidor.membros.filter((m) => m.permissao !== "ADMIN");

    return (
        <aside className="lista-membros">
            <Grupo titulo="Admins" membros={admins} donoId={servidor.dono.id} />
            <Grupo titulo="Membros" membros={membros} donoId={servidor.dono.id} />
        </aside>
    );
}

function Grupo({ titulo, membros, donoId }: { titulo: string; membros: Membro[]; donoId: string }) {
    if (membros.length === 0) {
        return null;
    }

    return (
        <section>
            <h3>{titulo} — {membros.length}</h3>
            {membros.map(({ usuario }) => (
                <div key={usuario.id} className="item-membro">
                    <Avatar nome={usuario.nome} url={usuario.avatarUrl} tamanho={32} />
                    <span className="truncar">{usuario.nome}</span>
                    {usuario.id === donoId && (
                        <span className="coroa" title="Dono do servidor"><IconeCoroa tamanho={14} /></span>
                    )}
                </div>
            ))}
        </section>
    );
}
