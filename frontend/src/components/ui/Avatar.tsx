import { useEffect, useState, type CSSProperties } from "react";
import { avatarReal, iniciais, matiz } from "../../lib/util";

type AvatarProps = {
    nome: string;
    url?: string | null;
    // "auto" deixa o CSS decidir o tamanho (blocos da chamada)
    tamanho?: number | "auto";
    falando?: boolean;
    className?: string;
};

export function Avatar({ nome, url, tamanho = 32, falando, className = "" }: AvatarProps) {
    const [falhou, setFalhou] = useState(false);
    const imagem = avatarReal(url);

    useEffect(() => setFalhou(false), [imagem]);

    const estilo = { "--h": matiz(nome) } as CSSProperties;
    if (tamanho !== "auto") {
        Object.assign(estilo, { width: tamanho, height: tamanho, fontSize: Math.max(10, Math.round(tamanho * 0.38)) });
    }

    return (
        <span className={`avatar ${falando ? "falando" : ""} ${className}`} style={estilo}>
            {imagem && !falhou ? (
                <img src={imagem} alt="" draggable={false} onError={() => setFalhou(true)} />
            ) : (
                <span className="avatar-iniciais">{iniciais(nome)}</span>
            )}
        </span>
    );
}

type IconeServidorProps = { nome: string; url?: string | null; tamanho?: number };

export function IconeServidor({ nome, url, tamanho = 40 }: IconeServidorProps) {
    return (
        <span
            className="icone-servidor"
            style={{ "--h": matiz(nome), width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.36), borderRadius: Math.round(tamanho * 0.32) } as CSSProperties}
        >
            {url ? <img src={url} alt="" draggable={false} /> : iniciais(nome)}
        </span>
    );
}
