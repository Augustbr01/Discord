// quando o site roda dentro do app desktop (Electron), o preload expõe `window.liberdadeDesktop`.
// No navegador é null e nada daqui roda. O outro lado fica em desktop/src/preload.ts
export type AtalhoDesktop = "mic" | "surdo";

type Desktop = {
    plataforma: string;
    // atalho global ou item da bandeja; devolve a função de parar de ouvir
    aoAtalho: (callback: (atalho: AtalhoDesktop) => void) => () => void;
    // total de não lidas: contador no ícone do app e na bandeja
    definirNaoLidos: (total: number) => void;
    // a bandeja mostra o microfone/áudio e alterna os dois
    definirVoz: (estado: { conectado: boolean; mic: boolean; surdo: boolean }) => void;
};

export const desktop: Desktop | null = (window as { liberdadeDesktop?: Desktop }).liberdadeDesktop ?? null;
