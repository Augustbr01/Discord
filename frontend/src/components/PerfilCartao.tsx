import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Camera, UserMinus } from "lucide-react";
import type { Usuario } from "../api";
import { avatarReal } from "../lib/util";
import { Avatar } from "./ui/Avatar";

type Props = {
    usuario: Usuario;
    ehVoce: boolean;
    // ainda está no servidor aberto (quem saiu só aparece pelas mensagens antigas)
    membro: boolean;
    // o elemento clicado: o cartão abre do lado dele
    ancora: HTMLElement;
    onFechar: () => void;
    onEditarFoto: () => void;
    // só vem quando você pode expulsar essa pessoa do servidor aberto
    onExpulsar?: () => void;
};

// distância mínima das bordas da janela e do elemento clicado
const MARGEM = 8;
const VAO = 10;

// "7 de outubro de 2026"
function dataLonga(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

// cartão de perfil que abre ao clicar em alguém (membros, chat, salas de voz)
export function PerfilCartao({ usuario, ehVoce, membro, ancora, onFechar, onEditarFoto, onExpulsar }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [posicao, setPosicao] = useState<{ left: number; top: number } | null>(null);

    // ao lado do que foi clicado: à direita se couber, senão à esquerda; sempre dentro da janela
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        // o elemento sumiu (mensagem apagada, lista recarregada): não tem do lado de quem abrir
        if (!ancora.isConnected) {
            onFechar();
            return;
        }
        const alvo = ancora.getBoundingClientRect();
        const { width, height } = el.getBoundingClientRect();
        let left = alvo.right + VAO;
        if (left + width > window.innerWidth - MARGEM) left = alvo.left - VAO - width;
        left = Math.min(Math.max(left, MARGEM), window.innerWidth - width - MARGEM);
        const top = Math.min(Math.max(alvo.top, MARGEM), window.innerHeight - height - MARGEM);
        setPosicao({ left, top });
    }, [ancora, usuario, onFechar]);

    // fecha com clique fora, Esc, rolagem ou mudança de tamanho da janela (o cartão é fixo e ficaria
    // longe de quem abriu). Clicar no próprio elemento que abriu não conta: quem alterna é ele
    useEffect(() => {
        const aoClicar = (e: MouseEvent) => {
            const alvo = e.target as Node;
            if (ref.current?.contains(alvo) || ancora.contains(alvo)) return;
            onFechar();
        };
        const aoTeclar = (e: KeyboardEvent) => {
            if (e.key === "Escape") onFechar();
        };
        const aoRolar = (e: Event) => {
            if (!ref.current?.contains(e.target as Node)) onFechar();
        };
        document.addEventListener("mousedown", aoClicar);
        document.addEventListener("keydown", aoTeclar);
        document.addEventListener("scroll", aoRolar, true);
        window.addEventListener("resize", onFechar);
        return () => {
            document.removeEventListener("mousedown", aoClicar);
            document.removeEventListener("keydown", aoTeclar);
            document.removeEventListener("scroll", aoRolar, true);
            window.removeEventListener("resize", onFechar);
        };
    }, [ancora, onFechar]);

    const fundo = avatarReal(usuario.avatarUrl);

    return createPortal(
        <div
            ref={ref}
            className="perfil"
            role="dialog"
            aria-label={`Perfil de ${usuario.nome}`}
            // primeiro mede escondido, depois aparece já no lugar certo
            style={posicao ?? { visibility: "hidden" }}
        >
            <div className="perfil-capa">
                {/* a própria foto, desfocada, vira a capa */}
                {fundo && <span className="perfil-capa-imagem" style={{ backgroundImage: `url(${JSON.stringify(fundo)})` }} />}
            </div>

            <div className="perfil-avatar">
                <Avatar nome={usuario.nome} url={usuario.avatarUrl} tamanho={84} />
            </div>

            <div className="perfil-corpo">
                <div className="perfil-nome">
                    <strong className="truncar">{usuario.nome}</strong>
                    {ehVoce && <span className="perfil-tag">Você</span>}
                </div>

                {usuario.entrou_em && (
                    <div className="perfil-secao">
                        <span className="rotulo">No Liberdade desde</span>
                        <span className="perfil-data">
                            <CalendarDays size={15} />
                            {dataLonga(usuario.entrou_em)}
                        </span>
                    </div>
                )}

                {!membro && <p className="perfil-aviso">Não faz mais parte deste servidor.</p>}

                {ehVoce && (
                    <button className="botao botao-pequeno botao-largo botao-contorno" onClick={onEditarFoto}>
                        <Camera size={14} />
                        Alterar foto
                    </button>
                )}

                {onExpulsar && (
                    <button className="botao botao-pequeno botao-largo botao-perigo-contorno" onClick={onExpulsar}>
                        <UserMinus size={14} />
                        Expulsar do servidor
                    </button>
                )}
            </div>
        </div>,
        document.body,
    );
}
