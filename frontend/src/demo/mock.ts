// Modo demo (só em `npm run dev`, abrindo com ?demo): responde as rotas /api/* com
// dados de exemplo, pra dar pra ver e ajustar o visual sem backend, Discord OAuth e Postgres.
// Salas de voz não conectam de verdade aqui (precisam do LiveKit).
import type { Canal, Membro, Mensagem, ServidorDetalhe, ServidorResumo, Usuario } from "../api";

const u = (id: string, nome: string): Usuario => ({ id, nome, avatarUrl: null });

const eu = u("u-augusto", "augusto");
const pessoas = {
    phelipe: u("u-phelipe", "phelipedev"),
    bia: u("u-bia", "bia.nogueira"),
    caio: u("u-caio", "caio_m"),
    duda: u("u-duda", "duda"),
    rafa: u("u-rafa", "rafa lins"),
    taina: u("u-taina", "tainá"),
    joao: u("u-joao", "joãozinho"),
    lu: u("u-lu", "lu.fontes"),
};

const membro = (usuario: Usuario, permissao: Membro["permissao"] = "MEMBRO"): Membro => ({ usuario, permissao });

const servidores: ServidorDetalhe[] = [
    {
        id: "s-facul",
        nome: "Galera da facul",
        iconeUrl: null,
        dono: { id: pessoas.phelipe.id, nome: pessoas.phelipe.nome },
        membros: [
            membro(pessoas.phelipe, "ADMIN"),
            membro(eu, "ADMIN"),
            membro(pessoas.bia),
            membro(pessoas.caio),
            membro(pessoas.duda),
            membro(pessoas.rafa),
            membro(pessoas.taina),
            membro(pessoas.joao),
            membro(pessoas.lu),
        ],
        canais: [
            { id: "c-geral", nome: "geral", tipo: "TEXTO" },
            { id: "c-avisos", nome: "avisos-da-turma", tipo: "TEXTO" },
            { id: "c-links", nome: "links-uteis", tipo: "TEXTO" },
            { id: "c-memes", nome: "memes", tipo: "TEXTO" },
            { id: "v-resenha", nome: "Resenha", tipo: "VOZ", participantes: [pessoas.bia, pessoas.caio, pessoas.duda, pessoas.rafa, pessoas.taina] },
            { id: "v-estudo", nome: "Estudo em grupo", tipo: "VOZ", participantes: [pessoas.lu] },
            { id: "v-jogando", nome: "Jogando", tipo: "VOZ", participantes: [] },
        ],
    },
    {
        id: "s-jogos",
        nome: "Noite de jogos",
        iconeUrl: null,
        dono: { id: eu.id, nome: eu.nome },
        membros: [membro(eu, "ADMIN"), membro(pessoas.caio), membro(pessoas.joao), membro(pessoas.rafa)],
        canais: [
            { id: "c-jogos-geral", nome: "geral", tipo: "TEXTO" },
            { id: "c-clips", nome: "clips", tipo: "TEXTO" },
            { id: "v-lobby", nome: "Lobby", tipo: "VOZ", participantes: [pessoas.joao, pessoas.rafa] },
        ],
    },
    {
        id: "s-tcc",
        nome: "TCC 2026",
        iconeUrl: null,
        dono: { id: pessoas.bia.id, nome: pessoas.bia.nome },
        membros: [membro(pessoas.bia, "ADMIN"), membro(eu), membro(pessoas.lu)],
        canais: [
            { id: "c-tcc", nome: "orientacao", tipo: "TEXTO" },
            { id: "v-tcc", nome: "Reunião", tipo: "VOZ", participantes: [] },
        ],
    },
];

function minutosAtras(min: number) {
    return new Date(Date.now() - min * 60_000).toISOString();
}

let seq = 0;
const msg = (autor: Usuario, conteudo: string, min: number): Mensagem => ({
    id: `m-${++seq}`,
    conteudo,
    criadoEm: minutosAtras(min),
    editadaEm: null,
    autor,
});

const mensagens: Record<string, Mensagem[]> = {
    "c-geral": [
        msg(pessoas.phelipe, "subi a versão nova do gateway, agora o canal some na hora pra todo mundo quando apaga", 60 * 26),
        msg(pessoas.phelipe, "se alguém achar bug me chama", 60 * 26 - 1),
        msg(pessoas.bia, "testei aqui e funcionou de primeira", 60 * 25),
        msg(pessoas.caio, "alguém vai na aula de redes amanhã?", 95),
        msg(pessoas.duda, "vou, mas chego atrasada", 93),
        msg(pessoas.duda, "guarda lugar pra mim", 92),
        msg(pessoas.rafa, "o professor mandou a lista 3 no moodle: https://moodle.exemplo.edu.br/mod/assign/view.php?id=4821", 61),
        msg(eu, "valeu rafa! vou fazer hoje à noite", 58),
        msg(pessoas.taina, "bora fazer junto na Resenha? to lá agora", 12),
        msg(pessoas.bia, "entrando", 11),
        msg(pessoas.caio, "a questão 4 é a do subnetting né", 4),
    ],
    "c-avisos": [msg(pessoas.phelipe, "prova de cálculo II foi adiada pra sexta, dia 16", 60 * 50)],
    "c-links": [],
    "c-memes": [msg(pessoas.joao, "quando o deploy passa de primeira", 200)],
    "c-jogos-geral": [
        msg(pessoas.joao, "hoje 21h?", 140),
        msg(pessoas.rafa, "fechou", 130),
    ],
    "c-clips": [],
    "c-tcc": [msg(pessoas.bia, "mandei o rascunho do capítulo 2 pra orientadora", 60 * 30)],
};

function resposta(dados: unknown, status = 200) {
    return new Response(status === 204 ? null : JSON.stringify(dados), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function detalheParaApi(s: ServidorDetalhe) {
    // o back manda as pessoas das salas como `pessoasVoz: { canalId: [usuarioId] }`
    const pessoasVoz: Record<string, string[]> = {};
    const canais: Canal[] = s.canais.map(({ participantes, ...c }) => {
        if (c.tipo === "VOZ") pessoasVoz[c.id] = (participantes ?? []).map((p) => p.id);
        return c;
    });
    return { ...s, canais, pessoasVoz };
}

function resumo(s: ServidorDetalhe): ServidorResumo {
    return { id: s.id, nome: s.nome, iconeUrl: s.iconeUrl };
}

async function rotear(caminho: string, init: RequestInit = {}): Promise<Response> {
    const metodo = (init.method ?? "GET").toUpperCase();
    const corpo = init.body ? JSON.parse(String(init.body)) : {};
    await new Promise((r) => setTimeout(r, 180)); // um pouco de latência pra ver os estados de carregamento

    if (caminho === "/dataUser") return resposta(eu);
    if (caminho === "/logout") return resposta(null, 204);
    if (caminho === "/servidor/listar") return resposta(servidores.map(resumo));

    if (caminho === "/servidor/criar" && metodo === "POST") {
        const novo: ServidorDetalhe = {
            id: `s-${Date.now()}`,
            nome: corpo.nomeServidor,
            iconeUrl: null,
            dono: { id: eu.id, nome: eu.nome },
            membros: [membro(eu, "ADMIN")],
            canais: [
                { id: `c-${Date.now()}`, nome: "geral", tipo: "TEXTO" },
                { id: `v-${Date.now()}`, nome: "Geral", tipo: "VOZ", participantes: [] },
            ],
        };
        servidores.push(novo);
        return resposta(resumo(novo));
    }

    if (caminho === "/servidor/sala-criar" && metodo === "POST") {
        const s = servidores.find((x) => x.id === corpo.servidorId);
        if (!s) return resposta({ mensagem: "Servidor não encontrado" }, 404);
        const canal: Canal = { id: `c-${Date.now()}`, nome: corpo.nomeCanal, tipo: corpo.tipoSala };
        s.canais.push(canal.tipo === "VOZ" ? { ...canal, participantes: [] } : canal);
        return resposta(canal);
    }

    const apagar = caminho.match(/^\/servidor\/sala-deletar\/(.+)$/);
    if (apagar && metodo === "DELETE") {
        for (const s of servidores) s.canais = s.canais.filter((c) => c.id !== apagar[1]);
        return resposta(null, 204);
    }

    if (caminho === "/servidor/convite-criar" && metodo === "POST") {
        return resposta({
            id: "0199a2b4-7c1e-7f3a-9d42-5b8e1c0a6f27",
            criadoEm: new Date().toISOString(),
            expiraEm: corpo.expiraEm ? new Date(Date.now() + corpo.expiraEm * 1000).toISOString() : null,
        });
    }

    if (caminho.startsWith("/servidor/convite/")) {
        return resposta({ mensagem: "Este convite expirou." }, 410);
    }

    const servidor = caminho.match(/^\/servidor\/([^/]+)$/);
    if (servidor) {
        const s = servidores.find((x) => x.id === servidor[1]);
        return s ? resposta(detalheParaApi(s)) : resposta({ mensagem: "Servidor não encontrado" }, 404);
    }

    const chat = caminho.match(/^\/canal\/([^/]+)\/mensagens$/);
    if (chat) {
        const lista = (mensagens[chat[1]] ??= []);
        if (metodo === "POST") {
            const nova = msg(eu, corpo.conteudo, 0);
            lista.push(nova);
            return resposta(nova);
        }
        return resposta(lista);
    }

    if (caminho.startsWith("/livekit/token")) {
        return resposta({ mensagem: "No modo demo as salas de voz não conectam. Rode o backend e o LiveKit pra testar a chamada." }, 503);
    }

    return resposta({ mensagem: `Rota de demo não encontrada: ${metodo} ${caminho}` }, 404);
}

// sem backend, o gateway só ficaria tentando reconectar: aqui ele fica parado
class WebSocketParado {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    close() {
        this.readyState = 3;
    }
    send() {}
}

export function instalar() {
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = (entrada: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
        // location.href e não location.origin: numa página embutida isolada a origem vale "null"
        let pathname = url;
        try {
            pathname = new URL(url, location.href).pathname;
        } catch {
            // url relativa que não deu pra resolver: usa como veio
        }
        if (pathname.startsWith("/api/")) return rotear(pathname.slice(4), init);
        return fetchOriginal(entrada, init);
    };

    const WebSocketOriginal = window.WebSocket;
    window.WebSocket = new Proxy(WebSocketOriginal, {
        construct(alvo, args: [string | URL, (string | string[])?]) {
            if (String(args[0]).includes("/api/gateway")) return new WebSocketParado();
            return new alvo(...args);
        },
    });
}
