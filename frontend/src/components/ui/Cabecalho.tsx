import type { ReactNode } from "react";
import { Menu } from "lucide-react";

type Props = {
    icone?: ReactNode;
    titulo: string;
    descricao?: ReactNode;
    onMenu: () => void;
    children?: ReactNode;
};

// barra do topo da área principal
export function Cabecalho({ icone, titulo, descricao, onMenu, children }: Props) {
    return (
        <header className="cabecalho">
            <button className="botao-icone so-celular" onClick={onMenu} aria-label="Abrir menu">
                <Menu size={20} />
            </button>

            <div className="cabecalho-titulo">
                {icone && <span className="cabecalho-icone">{icone}</span>}
                <strong className="truncar">{titulo}</strong>
                {descricao && (
                    <>
                        <span className="cabecalho-divisor" />
                        <span className="cabecalho-descricao truncar">{descricao}</span>
                    </>
                )}
            </div>

            {children && <div className="cabecalho-acoes">{children}</div>}
        </header>
    );
}
