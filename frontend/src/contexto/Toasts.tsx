import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

type TipoToast = "sucesso" | "erro" | "info";
type Toast = { id: number; tipo: TipoToast; texto: string };

const DURACAO_MS = 4200;
const ToastCtx = createContext<(tipo: TipoToast, texto: string) => void>(() => {});

const ICONES = {
    sucesso: <CircleCheck size={18} />,
    erro: <CircleAlert size={18} />,
    info: <Info size={18} />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const mostrar = useCallback((tipo: TipoToast, texto: string) => {
        const id = Date.now() + Math.random();
        setToasts((lista) => [...lista.slice(-3), { id, tipo, texto }]);
        setTimeout(() => setToasts((lista) => lista.filter((t) => t.id !== id)), DURACAO_MS);
    }, []);

    return (
        <ToastCtx.Provider value={mostrar}>
            {children}
            <div className="toasts" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.tipo}`}>
                        {ICONES[t.tipo]}
                        <span>{t.texto}</span>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

export function useToast() {
    const mostrar = useContext(ToastCtx);
    return useMemo(
        () => ({
            sucesso: (texto: string) => mostrar("sucesso", texto),
            erro: (texto: string) => mostrar("erro", texto),
            info: (texto: string) => mostrar("info", texto),
        }),
        [mostrar],
    );
}
