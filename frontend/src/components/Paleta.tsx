import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CornerDownLeft, Search } from "lucide-react";
import { normalizar } from "../lib/util";

export type ItemPaleta = {
    id: string;
    grupo: string;
    titulo: string;
    dica?: string;
    icone: ReactNode;
    acao: () => void;
};

// busca rápida (Ctrl/⌘ + K): pula pra canais e servidores e executa ações
export function Paleta({ itens, onFechar }: { itens: ItemPaleta[]; onFechar: () => void }) {
    const [busca, setBusca] = useState("");
    const [indice, setIndice] = useState(0);
    const listaRef = useRef<HTMLDivElement>(null);

    const filtrados = useMemo(() => {
        const termo = normalizar(busca);
        if (!termo) return itens;
        return itens.filter((i) => normalizar(`${i.titulo} ${i.dica ?? ""} ${i.grupo}`).includes(termo));
    }, [busca, itens]);

    useEffect(() => setIndice(0), [busca]);

    // mantém o item selecionado visível ao navegar com as setas
    useEffect(() => {
        listaRef.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
    }, [indice]);

    function executar(item: ItemPaleta | undefined) {
        if (!item) return;
        onFechar();
        item.acao();
    }

    function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndice((i) => Math.min(i + 1, filtrados.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndice((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            executar(filtrados[indice]);
        } else if (e.key === "Escape") {
            onFechar();
        }
    }

    // agrupa mantendo a ordem original
    const grupos: { nome: string; itens: { item: ItemPaleta; indice: number }[] }[] = [];
    filtrados.forEach((item, i) => {
        let grupo = grupos.find((g) => g.nome === item.grupo);
        if (!grupo) {
            grupo = { nome: item.grupo, itens: [] };
            grupos.push(grupo);
        }
        grupo.itens.push({ item, indice: i });
    });

    return createPortal(
        <div className="paleta-fundo" onMouseDown={onFechar}>
            <div className="paleta" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Busca rápida">
                <label className="paleta-busca">
                    <Search size={18} />
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        onKeyDown={aoTeclar}
                        placeholder="Ir para um canal, servidor ou ação…"
                        autoFocus
                    />
                    <kbd>Esc</kbd>
                </label>

                <div className="paleta-lista" ref={listaRef}>
                    {grupos.map((g) => (
                        <div key={g.nome} className="paleta-grupo">
                            <span className="rotulo">{g.nome}</span>
                            {g.itens.map(({ item, indice: i }) => (
                                <button
                                    key={item.id}
                                    data-indice={i}
                                    className={`paleta-item ${i === indice ? "ativo" : ""}`}
                                    onMouseMove={() => setIndice(i)}
                                    onClick={() => executar(item)}
                                >
                                    <span className="paleta-icone">{item.icone}</span>
                                    <span className="paleta-titulo truncar">{item.titulo}</span>
                                    {item.dica && <span className="paleta-dica truncar">{item.dica}</span>}
                                    {i === indice && <CornerDownLeft size={14} className="paleta-enter" />}
                                </button>
                            ))}
                        </div>
                    ))}

                    {filtrados.length === 0 && <p className="paleta-vazio">Nada encontrado para “{busca}”.</p>}
                </div>
            </div>
        </div>,
        document.body,
    );
}
