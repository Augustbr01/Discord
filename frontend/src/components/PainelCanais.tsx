import type { Canal, ServidorDetalhe, Usuario } from "../api";
import { Avatar } from "./Avatar";
import { IconeConvidar, IconeHash, IconeSair, IconeVoz } from "./Icones";

type Props = {
    servidor: ServidorDetalhe | null;
    canalId: string | null;
    vozConectadaId: string | null;
    eu: Usuario;
    souAdmin: boolean;
    onCanal: (canal: Canal) => void;
    onConvidar: () => void;
    onSair: () => void;
};

export function PainelCanais({ servidor, canalId, vozConectadaId, eu, souAdmin, onCanal, onConvidar, onSair }: Props) {
    const texto = servidor?.canais.filter((c) => c.tipo === "TEXTO") ?? [];
    const voz = servidor?.canais.filter((c) => c.tipo === "VOZ") ?? [];

    return (
        <aside className="painel-canais">
            <header className="painel-cabecalho">
                <span className="truncar">{servidor?.nome ?? ""}</span>
                {servidor && souAdmin && (
                    <button className="botao-icone" onClick={onConvidar} title="Convidar pessoas">
                        <IconeConvidar tamanho={18} />
                    </button>
                )}
            </header>

            <div className="lista-canais">
                {servidor && (
                    <>
                        <GrupoCanais titulo="Canais de texto" canais={texto} canalId={canalId} onCanal={onCanal} />
                        <GrupoCanais titulo="Canais de voz" canais={voz} canalId={canalId} onCanal={onCanal}
                            vozConectadaId={vozConectadaId} />
                    </>
                )}
            </div>

            <footer className="painel-usuario">
                <Avatar nome={eu.nome} url={eu.avatarUrl} tamanho={32} />
                <div className="painel-usuario-nome">
                    <strong className="truncar">{eu.nome}</strong>
                    <span>{vozConectadaId ? "Em chamada" : "Online"}</span>
                </div>
                <button className="botao-icone" onClick={onSair} title="Sair">
                    <IconeSair tamanho={18} />
                </button>
            </footer>
        </aside>
    );
}

type GrupoProps = {
    titulo: string;
    canais: Canal[];
    canalId: string | null;
    vozConectadaId?: string | null;
    onCanal: (canal: Canal) => void;
};

function GrupoCanais({ titulo, canais, canalId, vozConectadaId, onCanal }: GrupoProps) {
    if (canais.length === 0) {
        return null;
    }

    return (
        <section className="grupo-canais">
            <h3>{titulo}</h3>
            {canais.map((c) => (
                <button
                    key={c.id}
                    className={`item-canal ${c.id === canalId ? "ativo" : ""}`}
                    onClick={() => onCanal(c)}
                >
                    {c.tipo === "TEXTO" ? <IconeHash tamanho={18} /> : <IconeVoz tamanho={18} />}
                    <span className="truncar">{c.nome}</span>
                    {c.id === vozConectadaId && <span className="ponto-ao-vivo" title="Conectado" />}
                </button>
            ))}
        </section>
    );
}
