import type { CSSProperties, ReactNode } from "react";
import { HeadphoneOff, MicOff } from "lucide-react";
import { Avatar } from "../ui/Avatar";

type RodaProps = {
    quantidade: number;
    // o que fica no meio da roda (nome da sala, botão de entrar...)
    centro: ReactNode;
    children: ReactNode;
    className?: string;
};

// a sala de voz como uma roda de conversa: quem está nela senta em volta do nome da sala.
// As posições vêm do CSS (--i de --n); quando alguém entra ou sai, os outros deslizam pelo aro.
export function Roda({ quantidade, centro, children, className = "" }: RodaProps) {
    return (
        <div
            className={`roda ${quantidade === 0 ? "roda-vazia" : ""} ${className}`}
            style={{ "--n": Math.max(quantidade, 1) } as CSSProperties}
        >
            <span className="roda-aro" aria-hidden="true" />
            <div className="roda-centro">{centro}</div>
            <ul className="roda-assentos">{children}</ul>
        </div>
    );
}

type AssentoProps = {
    indice: number;
    nome: string;
    url?: string | null;
    falando?: boolean;
    mudo?: boolean;
    surdo?: boolean;
};

// uma pessoa na roda
export function Assento({ indice, nome, url, falando, mudo, surdo }: AssentoProps) {
    return (
        <li className={`assento ${falando ? "falando" : ""}`} style={{ "--i": indice } as CSSProperties}>
            <span className="assento-avatar">
                <Avatar nome={nome} url={url} tamanho="auto" falando={falando} />
                {(surdo || mudo) && (
                    <span className="assento-estado" role="img" aria-label={surdo ? "Áudio desativado" : "Microfone desativado"}>
                        {surdo ? <HeadphoneOff size={13} /> : <MicOff size={13} />}
                    </span>
                )}
            </span>
            <span className="assento-nome truncar">{nome}</span>
        </li>
    );
}
