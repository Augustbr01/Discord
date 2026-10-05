import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChat } from "@livekit/components-react";

export type MensagemSala = ReturnType<typeof useChat>["chatMessages"][number];

type ChatSala = {
    mensagens: MensagemSala[];
    enviar: (texto: string) => Promise<void>;
    enviando: boolean;
    naoLidas: number;
    marcarLidas: () => void;
};

const ChatCtx = createContext<ChatSala | null>(null);

// o chat da sala fica num provider acima das telas, pra não perder as mensagens
// quando você sai da tela da chamada e continua conectado.
// "desde" identifica a chamada atual (null = fora de chamada): ao entrar numa chamada nova,
// as mensagens das anteriores ficam de fora. Usa a posição na lista, não o horário,
// porque o relógio de cada pessoa pode estar diferente.
export function ChatSalaProvider({ desde, children }: { desde: number | null; children: ReactNode }) {
    const { chatMessages: todas, send, isSending } = useChat();
    const totalRef = useRef(todas.length);
    totalRef.current = todas.length;

    const [inicio, setInicio] = useState(0);
    const [lidas, setLidas] = useState(0);

    // nova chamada: começa a contar a partir das mensagens que já existiam
    useEffect(() => {
        setInicio(totalRef.current);
        setLidas(0);
    }, [desde]);

    const chatMessages = useMemo(
        () => (desde === null ? [] : todas.slice(inicio)),
        [todas, inicio, desde],
    );

    const enviar = useCallback(async (texto: string) => {
        await send(texto);
    }, [send]);

    const marcarLidas = useCallback(() => setLidas(chatMessages.length), [chatMessages.length]);

    const valor = useMemo<ChatSala>(() => ({
        mensagens: chatMessages,
        enviar,
        enviando: isSending,
        naoLidas: chatMessages.slice(lidas).filter((m) => !m.from?.isLocal).length,
        marcarLidas,
    }), [chatMessages, enviar, isSending, lidas, marcarLidas]);

    return <ChatCtx.Provider value={valor}>{children}</ChatCtx.Provider>;
}

export function useChatSala() {
    const valor = useContext(ChatCtx);
    if (!valor) throw new Error("useChatSala precisa estar dentro do ChatSalaProvider");
    return valor;
}
