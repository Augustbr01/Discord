import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Lado = "cima" | "baixo" | "direita";
type Props = { texto: string; lado?: Lado; children: ReactNode };

// dica (tooltip) desenhada fora da árvore, pra não ser cortada por áreas com rolagem
export function Dica({ texto, lado = "cima", children }: Props) {
    const ref = useRef<HTMLSpanElement>(null);
    const [posicao, setPosicao] = useState<{ x: number; y: number } | null>(null);

    function mostrar() {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        if (lado === "direita") setPosicao({ x: r.right + 10, y: r.top + r.height / 2 });
        else if (lado === "baixo") setPosicao({ x: r.left + r.width / 2, y: r.bottom + 8 });
        else setPosicao({ x: r.left + r.width / 2, y: r.top - 8 });
    }

    const esconder = () => setPosicao(null);

    return (
        <span
            ref={ref}
            className="dica-alvo"
            onMouseEnter={mostrar}
            onMouseLeave={esconder}
            onFocus={mostrar}
            onBlur={esconder}
            onMouseDown={esconder}
        >
            {children}
            {posicao && createPortal(
                <div className={`dica dica-${lado}`} style={{ left: posicao.x, top: posicao.y }} role="tooltip">
                    {texto}
                </div>,
                document.body,
            )}
        </span>
    );
}
