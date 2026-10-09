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

    // som da tela no Linux (audioTela.ts): só o juntarSomNaTela abaixo usa
    audioDaTela: (): Promise<boolean> => ipcRenderer.invoke(CANAIS.audioDaTela),
    pararAudioDaTela() {
        ipcRenderer.send(CANAIS.pararAudio);
    },
});

// roda na página (é o getDisplayMedia dela que o LiveKit chama), então não enxerga nada deste
// arquivo: só o window.liberdadeDesktop de cima
function juntarSomNaTela() {
    type Ponte = { audioDaTela(): Promise<boolean>; pararAudioDaTela(): void };
    const desktop = (window as unknown as { liberdadeDesktop: Ponte }).liberdadeDesktop;
    const dispositivos = navigator.mediaDevices;
    const original = dispositivos.getDisplayMedia.bind(dispositivos);

    // o microfone virtual aparece logo depois de ligado, mas não no mesmo instante: tenta por 1 s
    async function acharMicVirtual() {
        for (let i = 0; i < 10; i++) {
            const lista = await dispositivos.enumerateDevices();
            const mic = lista.find((d) => d.kind === "audioinput" && d.label === "vencord-screen-share");
            if (mic) return mic.deviceId;
            await new Promise((r) => setTimeout(r, 100));
        }
        return null;
    }

    dispositivos.getDisplayMedia = async (opcoes?: DisplayMediaStreamOptions) => {
        const stream = await original(opcoes);
        if (!(await desktop.audioDaTela())) return stream;
        try {
            const id = await acharMicVirtual();
            if (!id) throw new Error("o microfone virtual não apareceu");
            const som = await dispositivos.getUserMedia({
                audio: {
                    deviceId: { exact: id },
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false,
                    channelCount: 2,
                    sampleRate: 48000,
                },
            });
            const faixa = som.getAudioTracks()[0]!;
            for (const t of stream.getAudioTracks()) {
                stream.removeTrack(t);
                t.stop();
            }
            stream.addTrack(faixa);
            // parar de compartilhar: o LiveKit dá stop na faixa, e aí o microfone virtual é desligado
            const parar = faixa.stop.bind(faixa);
            faixa.stop = () => {
                parar();
                desktop.pararAudioDaTela();
            };
            faixa.addEventListener("ended", () => desktop.pararAudioDaTela());
        } catch (err) {
            console.warn("[liberdade] a tela vai sem som", err);
            desktop.pararAudioDaTela();
        }
        return stream;
    };
}

// no Linux o Electron entrega a tela sem som; nos outros o som vem pelo próprio getDisplayMedia
if (process.platform === "linux") contextBridge.executeInMainWorld({ func: juntarSomNaTela });
