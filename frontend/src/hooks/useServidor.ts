import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ServidorDetalhe } from "../api";

const RECARREGAR_MS = 10_000;

// carrega o servidor aberto e mantém atualizado (canais, membros, quem está nas salas)
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
        const t = setInterval(() => buscar(true), RECARREGAR_MS);

        return () => {
            ativo = false;
            clearInterval(t);
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
