import { useEffect, type ReactNode } from "react";
import { IconeX } from "./Icones";

type Props = { titulo: string; subtitulo?: string; onFechar: () => void; children: ReactNode };

export function Modal({ titulo, subtitulo, onFechar, children }: Props) {
    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
        window.addEventListener("keydown", aoTeclar);
        return () => window.removeEventListener("keydown", aoTeclar);
    }, [onFechar]);

    return (
        <div className="modal-fundo" onMouseDown={onFechar}>
            <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
                <button className="modal-fechar" onClick={onFechar} aria-label="Fechar"><IconeX /></button>
                <h2>{titulo}</h2>
                {subtitulo && <p className="modal-sub">{subtitulo}</p>}
                {children}
            </div>
        </div>
    );
}
