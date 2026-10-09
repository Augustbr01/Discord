// ponte da janelinha de escolher o que compartilhar (seletor.html)
import { contextBridge, ipcRenderer } from "electron";
import { CANAIS, type FonteTela } from "./canais";

contextBridge.exposeInMainWorld("seletor", {
    fontes: (): Promise<{ fontes: FonteTela[]; comAudio: boolean }> => ipcRenderer.invoke(CANAIS.fontes),
    escolher: (id: string | null) => ipcRenderer.send(CANAIS.escolher, id),
});
