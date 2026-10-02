import { useState } from "react";

export function iniciais(nome: string) {
    return nome
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .join("")
        .slice(0, 3)
        .toUpperCase();
}

type Props = { nome: string; url: string | null; tamanho?: number; className?: string };

// imagem redonda; se não tiver URL ou ela falhar, mostra as iniciais
export function Avatar({ nome, url, tamanho = 32, className = "" }: Props) {
    const [falhou, setFalhou] = useState(false);
    const estilo = { width: tamanho, height: tamanho, fontSize: tamanho * 0.38 };

    if (!url || falhou) {
        return <div className={`avatar avatar-iniciais ${className}`} style={estilo}>{iniciais(nome)}</div>;
    }

    return <img className={`avatar ${className}`} style={estilo} src={url} alt={nome} onError={() => setFalhou(true)} />;
}
