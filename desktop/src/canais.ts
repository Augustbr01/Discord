// nomes das mensagens entre o processo principal e as páginas (o site e o seletor de tela).
// O preload e o main importam daqui, então os dois lados não saem de sincronia

export const CANAIS = {
    // main → site: atalho global apertado (ou item da bandeja clicado)
    atalho: "liberdade:atalho",
    // site → main: total de mensagens não lidas (ícone na barra de tarefas/dock e bandeja)
    naoLidos: "liberdade:nao-lidos",
    // site → main: microfone e áudio, pra bandeja mostrar o estado e alternar
    voz: "liberdade:voz",
    // seletor de tela: lista as fontes e devolve a escolhida (ou null, cancelou)
    fontes: "liberdade:seletor-fontes",
    escolher: "liberdade:seletor-escolher",
    // seletor de som (Linux e Windows): os programas que podem mandar som e o escolhido
    programas: "liberdade:audio-programas",
    escolherAudio: "liberdade:audio-escolher",
    // site → main: a tela que acabou de vir leva som, e como? E: parou, pode desligar a captura
    audioDaTela: "liberdade:audio-da-tela",
    pararAudio: "liberdade:audio-parar",
    // main → site (Windows): o som capturado, em PCM 16 bits estéreo 48 kHz
    pcm: "liberdade:audio-pcm",
} as const;

// um programa que pode mandar som: no Linux o id é o nome dele no PipeWire, no Windows o pid
export type Programa = { id: string; nome: string };

// de onde sai o som da tela: um programa, todos (menos o Liberdade, só no Linux) ou nenhum
export type EscolhaAudio = ({ tipo: "programa" } & Programa) | { tipo: "tudo" } | { tipo: "nenhum" };

// como o som chega no site: microfone virtual (Linux) ou PCM pelo IPC (Windows)
export type ModoAudio = "virtual" | "pcm";

export type Atalho = "mic" | "surdo";

export type EstadoVoz = { conectado: boolean; mic: boolean; surdo: boolean };

export type FonteTela = {
    id: string;
    nome: string;
    tipo: "tela" | "janela";
    // dataURL (PNG) da miniatura e do ícone da janela
    miniatura: string;
    icone: string | null;
};
