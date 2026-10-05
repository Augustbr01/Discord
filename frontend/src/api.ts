// Todas as chamadas ao backend ficam aqui. Se mudar uma rota no Fastify, ajuste só este arquivo.

export type Usuario = { id: string; nome: string; avatarUrl: string | null };
export type Permissao = "ADMIN" | "MEMBRO";
export type TipoCanal = "TEXTO" | "VOZ";
// participantes: quem está na sala agora (só canais de voz, quando o back mandar)
export type Canal = { id: string; nome: string; tipo: TipoCanal; participantes?: Usuario[] };
export type Membro = { permissao: Permissao; usuario: Usuario };
export type ServidorResumo = { id: string; nome: string; iconeUrl: string | null };
export type ServidorDetalhe = ServidorResumo & {
    dono: { id: string; nome: string };
    membros: Membro[];
    canais: Canal[];
};
export type Convite = { id: string; criadoEm: string; expiraEm: string | null };
export type ConexaoVoz = { token: string; url: string };

// rotas de mensagem ainda não existem no back:
// GET  /api/canal/:id/mensagens -> Mensagem[]  (as últimas, da mais antiga pra mais nova)
// POST /api/canal/:id/mensagens { conteudo } -> Mensagem
export type Mensagem = {
    id: string;
    conteudo: string;
    criadoEm: string;
    editadaEm: string | null;
    autor: Usuario;
};

// igual ao VarChar(200) do model Mensagem
export const LIMITE_MENSAGEM = 200;

export class ErroApi extends Error {
    status: number;

    constructor(status: number, mensagem: string) {
        super(mensagem);
        this.status = status;
    }
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`/api${caminho}`, {
        ...init,
        // o Fastify recusa Content-Type JSON com corpo vazio, então só manda quando tem corpo
        headers: init.body ? { "Content-Type": "application/json" } : undefined,
    });

    if (res.status === 204) {
        return undefined as T;
    }

    const dados = await res.json().catch(() => null);

    if (!res.ok) {
        throw new ErroApi(res.status, dados?.mensagem ?? dados?.message ?? `Erro ${res.status}`);
    }

    return dados as T;
}

function post(corpo?: unknown): RequestInit {
    return corpo === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(corpo) };
}

export const api = {
    loginUrl: "/api/auth/discord",

    eu: () => chamar<Usuario>("/dataUser"),
    sair: () => chamar<void>("/logout", post()),

    listarServidores: () => chamar<ServidorResumo[]>("/servidor/listar"),
    obterServidor: async (id: string): Promise<ServidorDetalhe> => {
        // o back manda `pessoasVoz: { canalId: [usuarioId] }`; aqui cruzamos com os
        // membros pra virar o `participantes: Usuario[]` que o painel de canais já espera
        const bruto = await chamar<ServidorDetalhe & { pessoasVoz?: Record<string, string[]> }>(`/servidor/${id}`);
        const porId = new Map(bruto.membros.map((m) => [m.usuario.id, m.usuario]));
        const canais = bruto.canais.map((c) =>
            c.tipo === "VOZ"
                ? {
                      ...c,
                      participantes: (bruto.pessoasVoz?.[c.id] ?? [])
                          .map((uid) => porId.get(uid))
                          .filter((u): u is Usuario => u !== undefined),
                  }
                : c,
        );
        return { ...bruto, canais };
    },
    criarServidor: (nomeServidor: string) => chamar<ServidorResumo>("/servidor/criar", post({ nomeServidor })),
    criarCanal: (servidorId: string, nomeCanal: string, tipoSala: TipoCanal) =>
        chamar<Canal>("/servidor/sala-criar", post({ servidorId, nomeCanal, tipoSala })),
    apagarCanal: (canalId: string) => chamar<void>(`/servidor/sala-deletar/${canalId}`, { method: "DELETE" }),

    // expiraEm = segundos até expirar; undefined = convite permanente
    criarConvite: (idServidor: string, expiraEm?: number) =>
        chamar<Convite>("/servidor/convite-criar", post(expiraEm ? { idServidor, expiraEm } : { idServidor })),
    entrarConvite: (idConvite: string) =>
        chamar<{ servidor: ServidorResumo }>(`/servidor/convite/${idConvite}`, post()),

    listarMensagens: (canalId: string) => chamar<Mensagem[]>(`/canal/${canalId}/mensagens`),
    enviarMensagem: (canalId: string, conteudo: string) =>
        chamar<Mensagem>(`/canal/${canalId}/mensagens`, post({ conteudo })),

    tokenVoz: (canalId: string) =>
        chamar<ConexaoVoz>(`/livekit/token?${new URLSearchParams({ salaId: canalId })}`),
};

export function mensagemDeErro(err: unknown) {
    return err instanceof Error ? err.message : String(err);
}

// erros que podem significar sessão vencida (os hooks do back usam 400/401/404)
export function talvezDeslogado(err: unknown) {
    return err instanceof ErroApi && [400, 401, 404].includes(err.status);
}
