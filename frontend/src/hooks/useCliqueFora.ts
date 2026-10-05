import { useEffect, type RefObject } from "react";

// fecha menus/popovers ao clicar fora ou apertar Esc
export function useCliqueFora(ref: RefObject<HTMLElement | null>, ativo: boolean, onFora: () => void) {
    useEffect(() => {
        if (!ativo) return;

        const aoClicar = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onFora();
        };
        const aoTeclar = (e: KeyboardEvent) => {
            if (e.key === "Escape") onFora();
        };

        document.addEventListener("mousedown", aoClicar);
        document.addEventListener("keydown", aoTeclar);
        return () => {
            document.removeEventListener("mousedown", aoClicar);
            document.removeEventListener("keydown", aoTeclar);
        };
    }, [ref, ativo, onFora]);
}
