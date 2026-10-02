import type { ServidorResumo } from "../api";
import { Avatar } from "./Avatar";
import { IconeMais } from "./Icones";

type Props = {
    servidores: ServidorResumo[];
    selecionadoId: string | null;
    onSelecionar: (id: string) => void;
    onAdicionar: () => void;
};

export function BarraServidores({ servidores, selecionadoId, onSelecionar, onAdicionar }: Props) {
    return (
        <nav className="barra-servidores" aria-label="Servidores">
            <div className="item-servidor logo" title="Liberdade">🕊️</div>
            <div className="separador" />

            {servidores.map((s) => (
                <button
                    key={s.id}
                    className={`item-servidor ${s.id === selecionadoId ? "ativo" : ""}`}
                    onClick={() => onSelecionar(s.id)}
                    title={s.nome}
                >
                    <span className="pilula" />
                    <Avatar nome={s.nome} url={s.iconeUrl} tamanho={48} className="icone-servidor" />
                </button>
            ))}

            <button className="item-servidor adicionar" onClick={onAdicionar} title="Adicionar servidor">
                <IconeMais tamanho={22} />
            </button>
        </nav>
    );
}
