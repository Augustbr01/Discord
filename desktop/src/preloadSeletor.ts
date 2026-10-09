// ponte das janelinhas de escolher o que compartilhar (seletor.html) e de onde sai o som (seletorAudio.html)
import { contextBridge, ipcRenderer } from "electron";
import { CANAIS, type EscolhaAudio, type FonteTela, type Programa } from "./canais";

contextBridge.exposeInMainWorld("seletor", {
    fontes: (): Promise<FonteTela[]> => ipcRenderer.invoke(CANAIS.fontes),
    escolher: (id: string | null) => ipcRenderer.send(CANAIS.escolher, id),
    programas: (): Promise<{ programas: Programa[]; ultima: EscolhaAudio; podeTudo: boolean; rotulo: string }> =>
        ipcRenderer.invoke(CANAIS.programas),
    escolherAudio: (escolha: EscolhaAudio) => ipcRenderer.send(CANAIS.escolherAudio, escolha),
});
