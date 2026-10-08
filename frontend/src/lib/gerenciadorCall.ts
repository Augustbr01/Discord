// Quem cuida da conexão de voz (LiveKit). O app só diz "quero estar na call X" (ou em nenhuma)
// e o gerenciador leva a conexão até lá:
//
// - uma operação de cada vez, sempre atrás do pedido MAIS NOVO: trocar de sala três vezes
//   seguidas não dispara três conexões; as do meio do caminho nem chegam a ser feitas;
// - token em cache (e buscado antes, com aquecer()): a troca não espera ida e volta ao backend;
// - caiu a conexão (rede), volta sozinho; erro passageiro, tenta de novo PRA SEMPRE, com espera
//   crescente (até 5 s) — quem está dentro da sala nunca fica sem call por desistência;
// - conexão travada desiste em 8 s e tenta de novo (o padrão do LiveKit é 15 s);
// - um verificador confere a cada 3 s se a conexão está na sala pedida, e refaz se não estiver;
// - erro de verdade (sem permissão, aberto em outra aba, removido da sala) desiste e avisa.
//
// Antes isso era feito por efeitos do React (token -> estado -> props do LiveKitRoom), e uma troca
// rápida podia se perder no meio: o room.connect() do LiveKit ignora o token novo quando já está
// conectado, um connect cortado virava "falha", etc.
//
// Nunca confia só no connect(): confere o nome da sala em que a conexão realmente está. O LiveKit
// às vezes retoma sozinho uma conexão que foi cortada no meio (na sala antiga), e aí o connect()
// pra sala nova retorna na hora sem fazer nada ("already connected").
import {
    ConnectionError, ConnectionErrorReason, ConnectionState, DisconnectReason, Room, RoomEvent, type RoomOptions,
} from "livekit-client";

export type Credencial = { url: string; token: string };

// chave: o id da call (canal, ou hall-<servidor>), que é também o nome da sala no LiveKit;
// token: busca a credencial dela no backend
export type Destino = { chave: string; token: () => Promise<Credencial> };

export type MotivoPerda = "sem-permissao" | "falhou" | "outra-aba" | "removido";

export type EstadoCall = {
    // a call em que a conexão está agora (null = desconectado ou ainda conectando)
    conectadoEm: string | null;
    // a call pedida (null = nenhuma)
    desejado: string | null;
    // tentativas que falharam seguidas na call pedida (> 0: está tentando de novo)
    falhas: number;
};

const TOKEN_VALE_MS = 60 * 60 * 1000; // o token do LiveKit vale 6 h; renova bem antes
const ESPERA_MAXIMA_MS = 5000;
// conexão que não abre nesse tempo é dada como travada (o LiveKit desiste e o laço tenta de novo)
const CONEXAO_TRAVADA_MS = 8000;
const VERIFICAR_MS = 3000;
// o LiveKit retomando a conexão sozinho (rede oscilou): deixa ele, a não ser que trave
const RETOMADA_MAXIMA_MS = 10_000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// erro do backend (status 4xx): não adianta tentar de novo. 429 (muitas requisições) adianta
function statusDe(erro: unknown) {
    return typeof erro === "object" && erro !== null && "status" in erro && typeof erro.status === "number" ? erro.status : null;
}

export class GerenciadorCall {
    readonly room: Room;
    // avisado quando a call pedida não deu (ou caiu de vez): o app volta pra "sem call"
    onPerda: ((chave: string, motivo: MotivoPerda) => void) | null = null;

    private desejado: Destino | null = null;
    private noAr: string | null = null;
    private rodando = false;
    private tokens = new Map<string, { credencial: Credencial; ate: number }>();
    private buscando = new Map<string, Promise<Credencial>>();
    private aquecido = false;
    private estado: EstadoCall = { conectadoEm: null, desejado: null, falhas: 0 };
    private ouvintes = new Set<() => void>();
    private falhas = 0;
    // interrompe a espera entre tentativas (chegou pedido novo)
    private acordar: (() => void) | null = null;
    // desde quando o LiveKit está retomando a conexão sozinho
    private retomandoDesde: number | null = null;

    constructor(opcoes?: RoomOptions) {
        this.room = new Room(opcoes);
        this.room.on(RoomEvent.Disconnected, (motivo) => this.aoCair(motivo));
        // a conexão mudou por conta própria (ex.: o LiveKit retomou uma sala velha): confere
        this.room.on(RoomEvent.ConnectionStateChanged, () => {
            this.publicar();
            this.verificar();
        });
        // o verificador: qualquer coisa que nenhum evento avisou é pega aqui
        setInterval(() => this.verificar(), VERIFICAR_MS);
    }

    private retomando() {
        const s = this.room.state;
        return s === ConnectionState.Reconnecting || s === ConnectionState.SignalReconnecting;
    }

    // confere se a conexão está onde deve; se não, põe o laço pra trabalhar
    private verificar() {
        if (this.rodando) return;
        if (this.retomando()) {
            // o LiveKit está retomando sozinho (mais rápido que refazer): espera, até um limite
            this.retomandoDesde ??= Date.now();
            if (Date.now() - this.retomandoDesde < RETOMADA_MAXIMA_MS) return;
        }
        this.retomandoDesde = null;
        if (!this.certo()) void this.processar();
    }

    // a conexão está onde foi pedida?
    private certo() {
        const alvo = this.desejado;
        if (!alvo) return this.room.state === ConnectionState.Disconnected;
        return this.noAr === alvo.chave && this.room.state === ConnectionState.Connected && this.room.name === alvo.chave;
    }

    // ---------- pro React (useSyncExternalStore) ----------

    lerEstado = () => this.estado;

    assinar = (ouvinte: () => void) => {
        this.ouvintes.add(ouvinte);
        return () => {
            this.ouvintes.delete(ouvinte);
        };
    };

    private publicar() {
        const conectadoEm = this.noAr && this.room.state === ConnectionState.Connected && this.room.name === this.noAr ? this.noAr : null;
        const desejado = this.desejado?.chave ?? null;
        const falhas = this.falhas;
        if (conectadoEm === this.estado.conectadoEm && desejado === this.estado.desejado && falhas === this.estado.falhas) return;
        this.estado = { conectadoEm, desejado, falhas };
        this.ouvintes.forEach((f) => f());
    }

    // ---------- pedidos ----------

    ir(destino: Destino | null) {
        const chave = destino?.chave ?? null;
        if (chave === (this.desejado?.chave ?? null)) {
            // mesma call: só atualiza como buscar o token (não reinicia nada)
            if (destino && this.desejado) this.desejado.token = destino.token;
            return;
        }
        this.desejado = destino;
        this.falhas = 0;
        // esperando pra tentar de novo: o pedido novo não espera a pausa acabar
        this.acordar?.();
        // uma conexão em andamento NÃO é cortada: cortada no meio, ela às vezes entra na sala
        // do lado do servidor mesmo assim e fica lá como "fantasma" (sem o aviso de saída) até o
        // servidor desistir dela. Ela termina (~300 ms), sai limpa e o laço segue pra pedida
        this.publicar();
        void this.processar();
    }

    // busca os tokens dessas calls antes (ex.: as salas do andar ao abrir o 3D) e já abre o
    // caminho até o servidor do LiveKit: trocar de sala fica só a conexão em si
    aquecer(destinos: Destino[]) {
        for (const d of destinos) {
            this.credencial(d)
                .then((c) => {
                    if (this.aquecido) return;
                    this.aquecido = true;
                    this.room.prepareConnection(c.url, c.token).catch(() => {});
                })
                .catch(() => {});
        }
    }

    // ---------- o laço ----------

    private async credencial(destino: Destino) {
        const guardado = this.tokens.get(destino.chave);
        if (guardado && guardado.ate > Date.now()) return guardado.credencial;
        let pedido = this.buscando.get(destino.chave);
        if (!pedido) {
            pedido = destino.token().then(
                (credencial) => {
                    this.tokens.set(destino.chave, { credencial, ate: Date.now() + TOKEN_VALE_MS });
                    this.buscando.delete(destino.chave);
                    return credencial;
                },
                (erro) => {
                    this.buscando.delete(destino.chave);
                    throw erro;
                },
            );
            this.buscando.set(destino.chave, pedido);
        }
        return pedido;
    }

    // leva a conexão até o pedido mais novo. Só um laço por vez: pedidos que chegam no meio
    // são vistos na próxima volta
    private async processar() {
        if (this.rodando) return;
        this.rodando = true;
        try {
            for (;;) {
                const alvo = this.desejado;
                if (this.certo()) break;

                // sai da call em que está (ou da que ficou pela metade)
                if (this.room.state !== ConnectionState.Disconnected) {
                    await this.room.disconnect();
                    this.noAr = null;
                    this.publicar();
                }
                if (!alvo) continue;
                if (alvo !== this.desejado) continue;

                try {
                    const { url, token } = await this.credencial(alvo);
                    // pedido mudou, ou a conexão voltou sozinha enquanto buscava o token: outra volta
                    if (alvo !== this.desejado || this.room.state !== ConnectionState.Disconnected) continue;
                    await this.room.connect(url, token, { websocketTimeout: CONEXAO_TRAVADA_MS, peerConnectionTimeout: CONEXAO_TRAVADA_MS });
                    // só vale se a conexão está mesmo nessa sala; senão a próxima volta sai e refaz
                    if (this.room.name !== alvo.chave || (this.room.state as ConnectionState) !== ConnectionState.Connected) {
                        await esperar(100);
                        continue;
                    }
                    this.noAr = alvo.chave;
                    this.falhas = 0;
                    this.publicar();
                    // se o pedido mudou enquanto conectava, a próxima volta sai e vai pra ele
                } catch (erro) {
                    // cortado por um pedido mais novo: segue pra ele, não é falha
                    if (alvo !== this.desejado) continue;
                    if (erro instanceof ConnectionError && erro.reason === ConnectionErrorReason.Cancelled) continue;

                    const status = statusDe(erro);
                    const semPermissao = (status !== null && status >= 400 && status < 500 && status !== 429)
                        || (erro instanceof ConnectionError && erro.reason === ConnectionErrorReason.NotAllowed);
                    // token recusado pelo LiveKit pode ser só vencido: joga fora e tenta um novo uma vez
                    this.tokens.delete(alvo.chave);
                    this.falhas++;
                    this.publicar();
                    // sem permissão de verdade (de novo com token novo): não adianta insistir.
                    // Qualquer outra falha (rede, servidor, conexão travada) tenta pra sempre
                    if (semPermissao && this.falhas > 1) {
                        this.desistir(alvo.chave, "sem-permissao");
                        continue;
                    }
                    await this.pausa(Math.min(ESPERA_MAXIMA_MS, 300 * 2 ** this.falhas));
                }
            }
        } finally {
            this.rodando = false;
            this.publicar();
        }
    }

    // espera entre tentativas; um pedido novo (ir) interrompe
    private pausa(ms: number) {
        return new Promise<void>((resolver) => {
            const t = setTimeout(fim, ms);
            const self = this;
            function fim() {
                clearTimeout(t);
                if (self.acordar === fim) self.acordar = null;
                resolver();
            }
            this.acordar = fim;
        });
    }

    private desistir(chave: string, motivo: MotivoPerda) {
        if (this.desejado?.chave === chave) this.desejado = null;
        this.publicar();
        this.onPerda?.(chave, motivo);
    }

    // a conexão caiu sem a gente pedir
    private aoCair(motivo?: DisconnectReason) {
        const chave = this.noAr;
        this.noAr = null;
        this.publicar();
        // nós mesmos que desligamos (troca de sala, saída), ou nem estava em call
        if (motivo === DisconnectReason.CLIENT_INITIATED || !chave || this.rodando) return;
        if (motivo === DisconnectReason.DUPLICATE_IDENTITY) {
            this.desistir(chave, "outra-aba");
            return;
        }
        if (motivo === DisconnectReason.PARTICIPANT_REMOVED || motivo === DisconnectReason.ROOM_DELETED) {
            this.desistir(chave, "removido");
            return;
        }
        // rede, servidor reiniciando...: volta pra mesma call sozinho
        void this.processar();
    }
}
