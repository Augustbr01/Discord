import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
    titulo: string;
    descricao?: ReactNode;
    largura?: number;
    onFechar: () => void;
    children: ReactNode;
};

export function Dialogo({ titulo, descricao, largura = 440, onFechar, children }: Props) {
    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => {
            if (e.key === "Escape") onFechar();
        };
        window.addEventListener("keydown", aoTeclar);
        return () => window.removeEventListener("keydown", aoTeclar);
    }, [onFechar]);

    return createPortal(
        <div className="dialogo-fundo" onMouseDown={onFechar}>
            <div
                className="dialogo"
                style={{ maxWidth: largura }}
                role="dialog"
                aria-modal="true"
                aria-label={titulo}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <header className="dialogo-topo">
                    <div>
                        <h2>{titulo}</h2>
                        {descricao && <p>{descricao}</p>}
                    </div>
                    <button className="botao-icone" onClick={onFechar} aria-label="Fechar">
                        <X size={18} />
                    </button>
                </header>
                {children}
            </div>
        </div>,
        document.body,
    );
}
