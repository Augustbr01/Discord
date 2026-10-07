import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Usuario } from "../api";
import { PerfilCartao } from "../components/PerfilCartao";
import type { MapaMembros } from "../tipos";

type Perfil = {
    // abre o cartão de alguém ao lado do elemento clicado; clicar de novo no mesmo fecha
    abrirPerfil: (usuario: Usuario, ancora: HTMLElement) => void;
};

const Ctx = createContext<Perfil | null>(null);

type Props = {
    eu: Usuario;
    // membros do servidor aberto: têm os dados mais novos (foto trocada, entrou_em)
    membros: MapaMembros;
    // trocou de servidor: o cartão aberto era de lá, então fecha
    servidorId: string | null;
    onEditarFoto: () => void;
    children: ReactNode;
};

type Aberto = { usuario: Usuario; ancora: HTMLElement };

export function PerfilProvider({ eu, membros, servidorId, onEditarFoto, children }: Props) {
    const [aberto, setAberto] = useState<Aberto | null>(null);
    const fechar = useCallback(() => setAberto(null), []);

    useEffect(() => {
        fechar();
    }, [servidorId, fechar]);

    const abrirPerfil = useCallback((usuario: Usuario, ancora: HTMLElement) => {
        setAberto((atual) => (atual?.ancora === ancora ? null : { usuario, ancora }));
    }, []);

    const valor = useMemo(() => ({ abrirPerfil }), [abrirPerfil]);
    // quem abriu passou o que tinha na mão (ex.: o autor de uma mensagem antiga);
    // se a pessoa é membro, os dados do servidor são os mais atuais
    const usuario = aberto ? (membros.get(aberto.usuario.id) ?? aberto.usuario) : null;

    return (
        <Ctx.Provider value={valor}>
            {children}
            {aberto && usuario && (
                <PerfilCartao
                    usuario={usuario}
                    ehVoce={usuario.id === eu.id}
                    membro={membros.has(usuario.id)}
                    ancora={aberto.ancora}
                    onFechar={fechar}
                    onEditarFoto={() => {
                        fechar();
                        onEditarFoto();
                    }}
                />
            )}
        </Ctx.Provider>
    );
}

export function usePerfil() {
    const valor = useContext(Ctx);
    if (!valor) throw new Error("usePerfil precisa estar dentro do PerfilProvider");
    return valor;
}
