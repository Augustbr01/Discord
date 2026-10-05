import { useEffect, useState } from "react";

// relógio que atualiza sozinho (cronômetro da chamada)
export function useAgora(intervalo = 1000) {
    const [agora, setAgora] = useState(() => Date.now());

    useEffect(() => {
        const t = setInterval(() => setAgora(Date.now()), intervalo);
        return () => clearInterval(t);
    }, [intervalo]);

    return agora;
}
