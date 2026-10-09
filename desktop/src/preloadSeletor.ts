// ponte das janelinhas de escolher o que compartilhar (seletor.html) e de onde sai o som (seletorAudio.html)
import { contextBridge, ipcRenderer } from "electron";
import { CANAIS, type EscolhaAudio, type FonteTela } from "./canais";

contextBridge.exposeInMainWorld("seletor", {
    fontes: (): Promise<{ fontes: FonteTela[]; comAudio: boolean }> => ipcRenderer.invoke(CANAIS.fontes),
    escolher: (id: string | null) => ipcRenderer.send(CANAIS.escolher, id),
    programas: (): Promise<{ programas: string[]; ultima: EscolhaAudio }> => ipcRenderer.invoke(CANAIS.programas),
    escolherAudio: (escolha: EscolhaAudio) => ipcRenderer.send(CANAIS.escolherAudio, escolha),
});
