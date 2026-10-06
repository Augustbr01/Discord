import { useCallback, useEffect, useRef, useState } from "react";
import { api, ErroApi, type Mensagem, type Usuario } from "../api";
import { gateway } from "../lib/gateway";
import { idLocal } from "../lib/util";

// quantas mensagens o back manda por página (bate com o default do GET).
// se vier menos que isso, é porque não há mais histórico anterior.
const LIMITE = 50;

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
    // scroll infinito: se ainda há mensagens mais antigas pra buscar
    const [temMais, setTemMais] = useState(true);
    const [carregandoMais, setCarregandoMais] = useState(false);
    const carregandoRef = useRef(false); // trava síncrona contra buscas concorrentes

    useEffect(() => {
        let ativo = true;

        setEstado("carregando");
        setMensagens([]);
        setPendentes([]);
        setTemMais(true);
        setCarregandoMais(false);
        carregandoRef.current = false;

        const buscar = async (primeira: boolean) => {
            try {
                const lista = await api.listarMensagens(canalId);
                if (!ativo) return;
                setMensagens(ordenar(lista));
                setTemMais(lista.length >= LIMITE); // veio página cheia? pode ter mais
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

    // busca as mensagens anteriores à mais antiga que já temos (rolar pra cima)
    const carregarMais = useCallback(async () => {
        const maisAntiga = mensagens[0];
        if (!maisAntiga || carregandoRef.current) return;
        carregandoRef.current = true;
        setCarregandoMais(true);
        try {
            const antigas = await api.listarMensagens(canalId, maisAntiga.id);
            setMensagens((m) => {
                const ids = new Set(m.map((x) => x.id));
                const novas = antigas.filter((x) => !ids.has(x.id));
                return novas.length ? ordenar([...novas, ...m]) : m;
            });
            if (antigas.length < LIMITE) setTemMais(false); // chegou no começo do canal
        } catch {
            // deixa tentar de novo no próximo scroll
        } finally {
            carregandoRef.current = false;
            setCarregandoMais(false);
        }
    }, [canalId, mensagens]);

    return { estado, mensagens, pendentes, temMais, carregandoMais, enviar, reenviar, descartar, carregarMais };
}
