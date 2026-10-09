// a ponte entre o site e o app: o site vê `window.liberdadeDesktop` e sabe que está no desktop.
// Só passa o mínimo (nada de Node nem ipcRenderer solto); o tipo do lado do site fica em
// frontend/src/lib/desktop.ts
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { CANAIS, type Atalho, type EstadoVoz } from "./canais";

contextBridge.exposeInMainWorld("liberdadeDesktop", {
    plataforma: process.platform,

    aoAtalho(callback: (atalho: Atalho) => void) {
        const ouvinte = (_e: IpcRendererEvent, atalho: Atalho) => callback(atalho);
        ipcRenderer.on(CANAIS.atalho, ouvinte);
        return () => {
            ipcRenderer.removeListener(CANAIS.atalho, ouvinte);
        };
    },

    definirNaoLidos(total: number) {
        ipcRenderer.send(CANAIS.naoLidos, total);
    },

    definirVoz(estado: EstadoVoz) {
        ipcRenderer.send(CANAIS.voz, estado);
    },
});
