import { useCallback, useEffect, useState } from "react";
import { api, ErroApi, type Mensagem, type Usuario } from "../api";
import { gateway } from "../lib/gateway";
import { idLocal } from "../lib/util";

// mensagem que você mandou e ainda não voltou do servidor
export type MensagemLocal = {
    idLocal: string;
    conteudo: string;
    criadoEm: string;
    autor: Usuario;
    estado: "enviando" | "falhou";
};

// "indisponivel" = o back ainda não tem as rotas de mensagem (responde 404)
export type EstadoChat = "carregando" | "pronto" | "indisponivel" | "erro";

function ordenar(lista: Mensagem[]) {
    return [...lista].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
}

// histórico de um canal de texto: busca o inicial e recebe as novas pelo gateway
export function useMensagens(canalId: string, eu: Usuario) {
    const [estado, setEstado] = useState<EstadoChat>("carregando");
    const [mensagens, setMensagens] = useState<Mensagem[]>([]);
    const [pendentes, setPendentes] = useState<MensagemLocal[]>([]);

    useEffect(() => {
        let ativo = true;

        setEstado("carregando");
        setMensagens([]);
        setPendentes([]);

        const buscar = async (primeira: boolean) => {
            try {
                const lista = await api.listarMensagens(canalId);
                if (!ativo) return;
                setMensagens(ordenar(lista));
                setEstado("pronto");
            } catch (err) {
                if (!ativo) return;
                if (err instanceof ErroApi && (err.status === 404 || err.status === 405)) {
                    // rota não existe: nada a fazer
                    setEstado("indisponivel");
                    return;
                }
                if (primeira) setEstado("erro");
            }
        };

        buscar(true);

        // mensagem nova deste canal chega pelo gateway (dedup por id porque quem
        // enviou também recebe o próprio evento, além da resposta do POST)
        const pararEventos = gateway.assinar((evento) => {
            if (!ativo || evento.tipo !== "MENSAGEM_CRIADA" || evento.canalId !== canalId) return;
            setMensagens((m) => (m.some((x) => x.id === evento.mensagem.id) ? m : ordenar([...m, evento.mensagem])));
        });
        // ao reconectar, rebusca pra pegar o que chegou enquanto esteve offline
        const pararReconexao = gateway.aoReconectar(() => buscar(true));

        return () => {
            ativo = false;
            pararEventos();
            pararReconexao();
        };
    }, [canalId]);

    const mandar = useCallback(async (local: MensagemLocal) => {
        try {
            const salva = await api.enviarMensagem(canalId, local.conteudo);
            setPendentes((p) => p.filter((m) => m.idLocal !== local.idLocal));
            setMensagens((m) => (m.some((x) => x.id === salva.id) ? m : [...m, salva]));
        } catch {
            setPendentes((p) => p.map((m) => (m.idLocal === local.idLocal ? { ...m, estado: "falhou" } : m)));
        }
    }, [canalId]);

    const enviar = useCallback((conteudo: string) => {
        const local: MensagemLocal = {
            idLocal: idLocal(),
            conteudo,
            criadoEm: new Date().toISOString(),
            autor: eu,
            estado: "enviando",
        };
        setPendentes((p) => [...p, local]);
        mandar(local);
    }, [eu, mandar]);

    const reenviar = useCallback((id: string) => {
        const local = pendentes.find((m) => m.idLocal === id);
        if (!local) return;
        setPendentes((p) => p.map((m) => (m.idLocal === id ? { ...m, estado: "enviando" } : m)));
        mandar(local);
    }, [pendentes, mandar]);

    const descartar = useCallback((id: string) => {
        setPendentes((p) => p.filter((m) => m.idLocal !== id));
    }, []);

    return { estado, mensagens, pendentes, enviar, reenviar, descartar };
}
