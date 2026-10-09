// a ponte entre o site e o app: o site vê `window.liberdadeDesktop` e sabe que está no desktop.
// Só passa o mínimo (nada de Node nem ipcRenderer solto); o tipo do lado do site fica em
// frontend/src/lib/desktop.ts
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { CANAIS, type Atalho, type EstadoVoz, type ModoAudio } from "./canais";

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

    // som da tela (audioTela.ts): só o juntarSomNaTela abaixo usa
    audioDaTela: (): Promise<ModoAudio | null> => ipcRenderer.invoke(CANAIS.audioDaTela),
    pararAudioDaTela() {
        ipcRenderer.send(CANAIS.pararAudio);
    },
    aoPcmDaTela(callback: (pcm: Uint8Array) => void) {
        const ouvinte = (_e: IpcRendererEvent, pcm: Uint8Array) => callback(pcm);
        ipcRenderer.on(CANAIS.pcm, ouvinte);
        return () => {
            ipcRenderer.removeListener(CANAIS.pcm, ouvinte);
        };
    },
});

// roda na página (é o getDisplayMedia dela que o LiveKit chama), então não enxerga nada deste
// arquivo: só o window.liberdadeDesktop de cima
function juntarSomNaTela() {
    type Ponte = {
        audioDaTela(): Promise<"virtual" | "pcm" | null>;
        pararAudioDaTela(): void;
        aoPcmDaTela(callback: (pcm: Uint8Array) => void): () => void;
    };
    const desktop = (window as unknown as { liberdadeDesktop: Ponte }).liberdadeDesktop;
    const dispositivos = navigator.mediaDevices;
    const original = dispositivos.getDisplayMedia.bind(dispositivos);

    // Linux: o microfone virtual do venmic. Aparece logo depois de ligado, mas não no mesmo instante
    async function somDoMicVirtual() {
        for (let i = 0; i < 10; i++) {
            const lista = await dispositivos.enumerateDevices();
            const mic = lista.find((d) => d.kind === "audioinput" && d.label === "vencord-screen-share");
            if (mic) {
                const som = await dispositivos.getUserMedia({
                    audio: {
                        deviceId: { exact: mic.deviceId },
                        autoGainControl: false,
                        echoCancellation: false,
                        noiseSuppression: false,
                        channelCount: 2,
                        sampleRate: 48000,
                    },
                });
                return { faixa: som.getAudioTracks()[0]!, liberar: () => {} };
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error("o microfone virtual não apareceu");
    }

    // Windows: o PCM (16 bits, estéreo, 48 kHz) chega pelo IPC e um AudioWorklet toca ele numa faixa.
    // A fila guarda no máximo 200 ms: se atrasar, joga fora o mais velho (som em dia > som completo)
    const PROCESSADOR = `
        class Pcm extends AudioWorkletProcessor {
            constructor() {
                super();
                this.fila = [];
                this.amostras = 0;
                this.atual = null;
                this.pos = 0;
                this.port.onmessage = (e) => {
                    this.fila.push(e.data);
                    this.amostras += e.data.length;
                    while (this.amostras > 48000 * 2 * 0.2 && this.fila.length > 1) this.amostras -= this.fila.shift().length;
                };
            }
            process(_entradas, saidas) {
                const [esquerda, direita] = saidas[0];
                for (let i = 0; i < esquerda.length; i++) {
                    if (!this.atual || this.pos >= this.atual.length) {
                        this.atual = this.fila.shift() ?? null;
                        this.pos = 0;
                        if (this.atual) this.amostras -= this.atual.length;
                    }
                    esquerda[i] = this.atual ? this.atual[this.pos++] / 32768 : 0;
                    direita[i] = this.atual ? this.atual[this.pos++] / 32768 : 0;
                }
                return true;
            }
        }
        registerProcessor("liberdade-pcm", Pcm);`;

    async function somDoPcm() {
        const contexto = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
        const modulo = URL.createObjectURL(new Blob([PROCESSADOR], { type: "text/javascript" }));
        try {
            await contexto.audioWorklet.addModule(modulo);
        } finally {
            URL.revokeObjectURL(modulo);
        }
        const no = new AudioWorkletNode(contexto, "liberdade-pcm", { numberOfInputs: 0, outputChannelCount: [2] });
        const destino = contexto.createMediaStreamDestination();
        destino.channelCount = 2;
        no.connect(destino);
        const parar = desktop.aoPcmDaTela((pcm) => {
            // cópia alinhada: o Int16Array precisa começar num byte par
            const amostras = new Int16Array(pcm.byteLength / 2);
            new Uint8Array(amostras.buffer).set(pcm);
            no.port.postMessage(amostras, [amostras.buffer]);
        });
        void contexto.resume();
        return {
            faixa: destino.stream.getAudioTracks()[0]!,
            liberar: () => {
                parar();
                void contexto.close();
            },
        };
    }

    dispositivos.getDisplayMedia = async (opcoes?: DisplayMediaStreamOptions) => {
        const stream = await original(opcoes);
        const modo = await desktop.audioDaTela();
        if (!modo) return stream;
        try {
            const { faixa, liberar } = modo === "virtual" ? await somDoMicVirtual() : await somDoPcm();
            for (const t of stream.getAudioTracks()) {
                stream.removeTrack(t);
                t.stop();
            }
            stream.addTrack(faixa);
            // parar de compartilhar: o LiveKit dá stop na faixa, e aí a captura é desligada
            let encerrado = false;
            const encerrar = () => {
                if (encerrado) return;
                encerrado = true;
                liberar();
                desktop.pararAudioDaTela();
            };
            const parar = faixa.stop.bind(faixa);
            faixa.stop = () => {
                parar();
                encerrar();
            };
            faixa.addEventListener("ended", encerrar);
        } catch (err) {
            console.warn("[liberdade] a tela vai sem som", err);
            desktop.pararAudioDaTela();
        }
        return stream;
    };
}

// Linux e Windows: o Electron entrega a tela sem som, e o som do programa escolhido entra aqui
if (process.platform === "linux" || process.platform === "win32") contextBridge.executeInMainWorld({ func: juntarSomNaTela });
