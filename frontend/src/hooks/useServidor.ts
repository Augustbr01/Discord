import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ServidorDetalhe } from "../api";
import { gateway } from "../lib/gateway";
import type { EventoGateway } from "../tipos";

// aplica um evento do gateway no servidor em memória.
// eventos de outro servidor (canal que não é daqui) são ignorados.
// tira alguém da lista de membros e de qualquer sala de voz em que estivesse
export function removerMembro(s: ServidorDetalhe, usuarioId: string): ServidorDetalhe {
    return {
        ...s,
        membros: s.membros.filter((m) => m.usuario.id !== usuarioId),
        canais: s.canais.map((c) =>
            c.participantes
                ? { ...c, participantes: c.participantes.filter((p) => p.id !== usuarioId), telas: (c.telas ?? []).filter((id) => id !== usuarioId) }
                : c,
        ),
    };
}

function aplicar(s: ServidorDetalhe, evento: EventoGateway): ServidorDetalhe {
    if (evento.tipo === "ENTROU_NA_CALL" || evento.tipo === "SAIU_DA_CALL") {
        if (!s.canais.some((c) => c.id === evento.canalId)) return s;
        const usuario = s.membros.find((m) => m.usuario.id === evento.usuarioId)?.usuario;
        return {
            ...s,
            canais: s.canais.map((c) => {
                if (c.id !== evento.canalId) return c;
                const atuais = c.participantes ?? [];
                if (evento.tipo === "ENTROU_NA_CALL") {
                    if (!usuario || atuais.some((p) => p.id === usuario.id)) return c;
                    return { ...c, participantes: [...atuais, usuario] };
                }
                // saiu da sala: se estava compartilhando, a tela sai junto
                return {
                    ...c,
                    participantes: atuais.filter((p) => p.id !== evento.usuarioId),
                    telas: (c.telas ?? []).filter((id) => id !== evento.usuarioId),
                };
            }),
        };
    }
    if (evento.tipo === "MEMBROS") {
        if (evento.servidorId !== s.id || !evento.usuarioId) return s;
        return removerMembro(s, evento.usuarioId);
    }
    if (evento.tipo === "TELA") {
        if (!s.canais.some((c) => c.id === evento.canalId)) return s; // não é daqui
        return {
            ...s,
            canais: s.canais.map((c) => {
                if (c.id !== evento.canalId) return c;
                const atuais = c.telas ?? [];
                if (evento.statusTela === "ABRIU") {
                    return atuais.includes(evento.usuarioId) ? c : { ...c, telas: [...atuais, evento.usuarioId] };
                }
                return { ...c, telas: atuais.filter((id) => id !== evento.usuarioId) };
            }),
        };
    }
    if (evento.tipo === "CANAL_CRIADO") {
        // o evento é de outro servidor, ou eu mesmo já adicionei esse canal ao criar
        if (evento.servidorId !== s.id || s.canais.some((c) => c.id === evento.canal.id)) return s;
        return { ...s, canais: [...s.canais, evento.canal] };
    }
    if (evento.tipo === "MEMBRO_ENTROU") {
        if (evento.servidorId !== s.id || s.membros.some((m) => m.usuario.id === evento.membro.usuario.id)) return s;
        return { ...s, membros: [...s.membros, evento.membro] };
    }
    if (evento.tipo === "CANAL_APAGADO") {
        if (!s.canais.some((c) => c.id === evento.canalId)) return s; // não é daqui
        return { ...s, canais: s.canais.filter((c) => c.id !== evento.canalId) };
    }
    if (evento.tipo === "UPDATE_SERVER") {
        if (evento.servidorId !== s.id) return s;
        return { ...s, nome: evento.nome };
    }
    return s;
}

// carrega o servidor aberto e o mantém atualizado pelo gateway (canais, membros,
// quem está nas salas). Sem polling: o servidor empurra as mudanças.
export function useServidor(id: string | null, aoErrar: (err: unknown) => void) {
    const [servidor, setServidor] = useState<ServidorDetalhe | null>(null);
    const aoErrarRef = useRef(aoErrar);

    useEffect(() => {
        aoErrarRef.current = aoErrar;
    }, [aoErrar]);

    useEffect(() => {
        setServidor(null);
        if (!id) return;

        let ativo = true;
        const buscar = (silencioso: boolean) =>
            api.obterServidor(id)
                .then((s) => {
                    if (ativo) setServidor(s);
                })
                .catch((err) => {
                    if (ativo && !silencioso) aoErrarRef.current(err);
                });

        buscar(false);

        // a cada (re)conexão, rebusca o snapshot pra não ficar sem o que passou
        // enquanto a conexão esteve caída
        const pararReconexao = gateway.aoReconectar(() => buscar(true));
        // mudanças ao vivo (entrar/sair de call) chegam aqui
        const pararEventos = gateway.assinar((evento) => {
            if (!ativo) return;
            // saiu alguém, mas o evento não diz quem: só dá pra rebuscar a lista
            if (evento.tipo === "MEMBROS" && evento.servidorId === id && !evento.usuarioId) {
                buscar(true);
                return;
            }
            setServidor((s) => (s ? aplicar(s, evento) : s));
        });

        return () => {
            ativo = false;
            pararReconexao();
            pararEventos();
        };
    }, [id]);

    const recarregar = useCallback(() => {
        if (!id) return;
        api.obterServidor(id)
            // só troca se ainda for o mesmo servidor aberto
            .then((s) => setServidor((atual) => (atual?.id === s.id ? s : atual)))
            .catch(() => {});
    }, [id]);

    return { servidor, setServidor, recarregar };
}
