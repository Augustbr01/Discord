// Tela de carregamento do 3D: o passarinho da marca voando no lugar. Não importa nada do
// three, então serve também de fallback enquanto o chunk do Mundo3D baixa (no App).
import { useEffect, useState, type CSSProperties } from "react";

// quando a tela anterior sumiu: o fallback do App e a tela do Mundo3D se revezam no mesmo
// lugar, e a segunda não pode piscar nem recomeçar o voo
let saiuEm = -Infinity;

type Props = { texto: string; saindo?: boolean };

export function TelaCarregando({ texto, saindo = false }: Props) {
    const [inicio] = useState(() => {
        const agora = performance.now();
        return { fase: agora, entrar: agora - saiuEm > 400 };
    });
    useEffect(() => () => void (saiuEm = performance.now()), []);

    // atraso negativo: as animações em loop continuam de onde a tela anterior parou
    const estilo = { "--fase": `-${Math.round(inicio.fase)}ms` } as CSSProperties;

    return (
        <div
            className={`mundo-carregando${inicio.entrar ? " entrando" : ""}${saindo ? " saindo" : ""}`}
            style={estilo}
            role="status"
            aria-live="polite"
        >
            <div className="carregando-marca">
                <span className="carregando-onda" />
                <span className="carregando-onda" />
                <div className="carregando-ladrilho">
                    <span className="carregando-vento" />
                    <span className="carregando-vento" />
                    <span className="carregando-vento" />
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <g className="carregando-passaro">
                            <path className="carregando-corpo" d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
                            <path d="m20 7 2 .5-2 .5" />
                            <path d="M10 18v3" />
                            <path d="M14 17.75V21" />
                            <path className="carregando-olho" d="M16 7h.01" />
                            <path className="carregando-asa" d="M7 18a6 6 0 0 0 3.84-10.61" />
                        </g>
                    </svg>
                </div>
            </div>
            <span key={texto} className="carregando-texto">
                {texto}
            </span>
            <span className="carregando-barra" />
        </div>
    );
}
