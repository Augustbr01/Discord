// Todas as chamadas ao backend ficam aqui. Se mudar uma rota no Fastify, ajuste só este arquivo.

export type Usuario = { id: string; nome: string; avatarUrl: string };
export type Permissao = "ADMIN" | "MEMBRO";
export type TipoCanal = "TEXTO" | "VOZ";
export type Canal = { id: string; nome: string; tipo: TipoCanal };
export type Membro = { permissao: Permissao; usuario: Usuario };
export type ServidorResumo = { id: string; nome: string; iconeUrl: string | null };
export type ServidorDetalhe = ServidorResumo & {
    dono: { id: string; nome: string };
    membros: Membro[];
    canais: Canal[];
};
export type Convite = { id: string; criadoEm: string; expiraEm: string | null };
export type ConexaoVoz = { token: string; url: string };

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
    obterServidor: (id: string) => chamar<ServidorDetalhe>(`/servidor/${id}`),
    criarServidor: (nomeServidor: string) => chamar<ServidorResumo>("/servidor/criar", post({ nomeServidor })),

    // expiraEm = segundos até expirar; undefined = convite permanente
    criarConvite: (idServidor: string, expiraEm?: number) =>
        chamar<Convite>("/servidor/convite-criar", post(expiraEm ? { idServidor, expiraEm } : { idServidor })),
    entrarConvite: (idConvite: string) =>
        chamar<{ servidor: ServidorResumo }>(`/servidor/convite/${idConvite}`, post()),

    tokenVoz: (canalId: string) =>
        chamar<ConexaoVoz>(`/livekit/token?${new URLSearchParams({ salaId: canalId })}`),
};

export function mensagemDeErro(err: unknown) {
    return err instanceof Error ? err.message : String(err);
}

export function naoLogado(err: unknown) {
    return err instanceof ErroApi && err.status === 401;
}
