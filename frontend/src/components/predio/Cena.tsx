import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, Texture } from "three";
import type { Alvo, Comandos } from "./Jogador";
import {
    COR, coresPessoa, texturaMural, texturaNome, texturaPainelElevador, texturaPlaca, texturaQuadro, texturaRotulo,
} from "./materiais";
import { ELEVADOR_PLANTA, PE_DIREITO, type PainelMural, type Parede, type Planta, type SalaPlanta } from "./planta";

// quem está sentado numa sala (você não aparece: você é a câmera)
export type PessoaNaSala = { id: string; nome: string; falando: boolean };
export type InfoSala = { pessoas: PessoaNaSala[]; contagem: number; voceAqui: boolean };

type Props = {
    planta: Planta;
    andar: number;
    servidorNome: string;
    salas: Map<string, InfoSala>;
    alvo: Alvo | null;
    comandos: RefObject<Comandos>;
    portasAbertas: boolean;
};

// textura de canvas que é liberada da GPU quando sai de cena
function useTextura(criar: () => Texture, chave: string) {
    const textura = useMemo(criar, [chave]);
    useEffect(() => () => textura.dispose(), [textura]);
    return textura;
}

export function Cena({ planta, andar, servidorNome, salas, alvo, comandos, portasAbertas }: Props) {
    const largura = 21;
    const inicio = ELEVADOR_PLANTA.fundo + 0.2;
    const profundidade = inicio - planta.fim + 0.2;
    const meioZ = (inicio + planta.fim) / 2;

    // luzes do corredor a cada 8 m
    const luzes: number[] = [];
    for (let z = 0; z > planta.fim; z -= 8) luzes.push(z);

    return (
        <>
            <color attach="background" args={[COR.casca]} />
            <fog attach="fog" args={[COR.casca, 9, 44]} />
            <hemisphereLight args={["#b7e0e3", "#0b3a42", 0.95]} />
            <ambientLight intensity={0.25} />

            {/* piso, tapete-guia do corredor e teto */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, meioZ]}>
                <planeGeometry args={[largura, profundidade]} />
                <meshStandardMaterial color={COR.piso} roughness={0.92} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, (2 + planta.fim) / 2]}>
                <planeGeometry args={[1.5, 2 - planta.fim - 0.6]} />
                <meshStandardMaterial color="#123e46" roughness={1} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, PE_DIREITO, meioZ]}>
                <planeGeometry args={[largura, profundidade]} />
                <meshStandardMaterial color={COR.teto} roughness={1} />
            </mesh>

            {/* faixas de luz no teto do corredor */}
            {Array.from({ length: Math.floor((2 - planta.fim) / 4) }, (_, i) => (
                <mesh key={i} position={[0, PE_DIREITO - 0.02, 0.5 - i * 4]} rotation={[Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[0.22, 2.4]} />
                    <meshBasicMaterial color={COR.luz} toneMapped={false} />
                </mesh>
            ))}
            {luzes.map((z) => (
                <pointLight key={z} position={[0, 2.6, z]} color={COR.luz} intensity={22} distance={14} decay={2} />
            ))}

            {planta.paredes.map((p, i) => (
                <ParedeMesh key={i} parede={p} />
            ))}

            {planta.salas.map((s) => (
                <Sala key={s.canal.id} sala={s} info={salas.get(s.canal.id) ?? { pessoas: [], contagem: 0, voceAqui: false }} />
            ))}

            <Mural paineis={planta.mural} alvo={alvo} />
            <Quadro andar={andar} servidorNome={servidorNome} planta={planta} salas={salas} />
            <Elevador andar={andar} comandos={comandos} abertas={portasAbertas} />
        </>
    );
}

function ParedeMesh({ parede }: { parede: Parede }) {
    const doElevador = parede.cz > ELEVADOR_PLANTA.frente + 0.05 && Math.abs(parede.cx) <= ELEVADOR_PLANTA.meiaLargura + 0.01;
    const daSala = Math.abs(parede.cx) > 2.05;

    if (parede.vidro) {
        return (
            <mesh position={[parede.cx, PE_DIREITO / 2, parede.cz]}>
                <boxGeometry args={[0.06, PE_DIREITO, parede.d]} />
                <meshStandardMaterial color={COR.vidro} transparent opacity={0.13} roughness={0.08} metalness={0.3} depthWrite={false} />
            </mesh>
        );
    }

    return (
        <mesh position={[parede.cx, PE_DIREITO / 2, parede.cz]}>
            <boxGeometry args={[parede.w, PE_DIREITO, parede.d]} />
            <meshStandardMaterial
                color={doElevador ? COR.elevador : daSala ? COR.paredeSala : COR.parede}
                roughness={doElevador ? 0.4 : 0.95}
                metalness={doElevador ? 0.5 : 0}
            />
        </mesh>
    );
}

// uma sala de voz: porta de vidro, placa, tapete e a roda de cadeiras com quem está lá
function Sala({ sala, info }: { sala: SalaPlanta; info: InfoSala }) {
    const { lado, cx, cz, canal } = sala;
    const ocupada = info.contagem > 0;
    const placa = useTextura(() => texturaPlaca(canal.nome, info.contagem, info.voceAqui), `${canal.nome}|${info.contagem}|${info.voceAqui}`);

    const cadeiras = Math.min(12, Math.max(6, info.pessoas.length + 2));
    const raio = 2.1;
    // nenhuma cadeira fica bem na frente da porta: com número par a roda gira meio passo,
    // com ímpar a cadeira "sobrando" já cai no fundo, oposta à porta
    const passo = (Math.PI * 2) / cadeiras;
    const fundo = (lado > 0 ? 0 : Math.PI) + (cadeiras % 2 === 0 ? passo / 2 : 0);
    const lugares = Array.from({ length: cadeiras }, (_, i) => {
        const a = fundo + i * passo;
        const x = cx + Math.cos(a) * raio;
        const z = cz + Math.sin(a) * raio;
        return { x, z, rot: Math.atan2(-(cx - x), -(cz - z)) };
    });
    // as pessoas ocupam primeiro os lugares do fundo, de frente pra porta: quem entra vê os rostos
    const porta = { x: lado * 2, z: cz };
    const ordem = lugares
        .map((l, i) => ({ i, d: Math.hypot(l.x - porta.x, l.z - porta.z) }))
        .sort((a, b) => b.d - a.d)
        .map((l) => l.i);
    const ocupados = new Map<number, PessoaNaSala>();
    info.pessoas.forEach((p, k) => ocupados.set(ordem[k % cadeiras], p));

    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.003, cz]}>
                <planeGeometry args={[8, 8]} />
                <meshStandardMaterial color={COR.pisoSala} roughness={0.95} />
            </mesh>
            <mesh position={[cx, 0.012, cz]}>
                <cylinderGeometry args={[2.8, 2.8, 0.02, 48]} />
                <meshStandardMaterial color={ocupada ? COR.tapete : "#173c42"} roughness={1} />
            </mesh>

            {/* luminária no centro da roda: acesa quando tem gente */}
            <mesh position={[cx, PE_DIREITO - 0.12, cz]}>
                <cylinderGeometry args={[0.45, 0.7, 0.2, 32]} />
                <meshStandardMaterial
                    color={COR.moldura}
                    emissive={ocupada ? COR.manga : "#4d6b70"}
                    emissiveIntensity={ocupada ? 0.9 : 0.25}
                />
            </mesh>
            <pointLight
                position={[cx, 2.3, cz]}
                color={ocupada ? "#ffd08f" : "#9fd3d8"}
                intensity={ocupada ? 34 : 10}
                distance={10}
                decay={2}
            />

            {/* batente da porta e a placa virada pro corredor */}
            <mesh position={[lado * 2, 2.65, cz]}>
                <boxGeometry args={[0.24, 0.7, 2.3]} />
                <meshStandardMaterial color={COR.moldura} roughness={0.8} />
            </mesh>
            {[-1.15, 1.15].map((dz) => (
                <mesh key={dz} position={[lado * 2, 1.5, cz + dz]}>
                    <boxGeometry args={[0.24, PE_DIREITO, 0.08]} />
                    <meshStandardMaterial color={COR.moldura} roughness={0.8} />
                </mesh>
            ))}
            <mesh position={[lado * 1.86, 2.62, cz]} rotation={[0, lado < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
                <planeGeometry args={[2.08, 0.65]} />
                <meshBasicMaterial map={placa} toneMapped={false} />
            </mesh>

            {lugares.map((l, i) => {
                const pessoa = ocupados.get(i);
                return pessoa ? (
                    <Pessoa key={pessoa.id} pessoa={pessoa} x={l.x} z={l.z} rot={l.rot} fase={i * 1.7} />
                ) : (
                    <group key={`livre-${i}`} position={[l.x, 0, l.z]} rotation={[0, l.rot, 0]}>
                        <Cadeira />
                    </group>
                );
            })}
        </group>
    );
}

function Cadeira() {
    return (
        <group>
            <mesh position={[0, 0.21, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.42, 8]} />
                <meshStandardMaterial color={COR.moldura} />
            </mesh>
            <mesh position={[0, 0.45, 0]}>
                <boxGeometry args={[0.52, 0.08, 0.5]} />
                <meshStandardMaterial color={COR.cadeira} roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.76, 0.24]}>
                <boxGeometry args={[0.52, 0.56, 0.07]} />
                <meshStandardMaterial color={COR.cadeira} roughness={0.85} />
            </mesh>
        </group>
    );
}

// uma pessoa sentada: corpo e cabeça no tom dela, nome em cima; quem fala ganha o anel manga
function Pessoa({ pessoa, x, z, rot, fase }: { pessoa: PessoaNaSala; x: number; z: number; rot: number; fase: number }) {
    const cores = coresPessoa(pessoa.nome);
    const etiqueta = useTextura(() => texturaNome(pessoa.nome, pessoa.falando), `${pessoa.nome}|${pessoa.falando}`);
    const cabeca = useRef<Group>(null);
    const anel = useRef<Mesh>(null);

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        if (cabeca.current) {
            const respirar = Math.sin(t * 1.4 + fase) * 0.012;
            const falar = pessoa.falando ? Math.abs(Math.sin(t * 9 + fase)) * 0.025 : 0;
            cabeca.current.position.y = 1.29 + respirar + falar;
        }
        if (anel.current) {
            const s = 1 + (Math.sin(t * 5) + 1) * 0.06;
            anel.current.scale.set(s, s, s);
        }
    });

    return (
        <group position={[x, 0, z]} rotation={[0, rot, 0]}>
            <Cadeira />
            <mesh position={[0, 0.8, 0.04]}>
                <capsuleGeometry args={[0.19, 0.3, 6, 14]} />
                <meshStandardMaterial color={cores.corpo} roughness={0.8} />
            </mesh>
            <group ref={cabeca} position={[0, 1.29, 0.02]}>
                <mesh>
                    <sphereGeometry args={[0.16, 22, 16]} />
                    <meshStandardMaterial color={cores.cabeca} roughness={0.7} />
                </mesh>
                {/* olhos, virados pro centro da roda */}
                {[-0.055, 0.055].map((ox) => (
                    <mesh key={ox} position={[ox, 0.025, -0.148]}>
                        <sphereGeometry args={[0.022, 10, 8]} />
                        <meshBasicMaterial color="#0d1f22" />
                    </mesh>
                ))}
            </group>
            {pessoa.falando && (
                <mesh ref={anel} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                    <ringGeometry args={[0.42, 0.5, 40]} />
                    <meshBasicMaterial color={COR.manga} toneMapped={false} />
                </mesh>
            )}
            <sprite position={[0, 1.66, 0.02]} scale={[0.78, 0.195, 1]}>
                <spriteMaterial map={etiqueta} transparent depthWrite={false} toneMapped={false} />
            </sprite>
        </group>
    );
}

// mural dos canais de texto, na saída do elevador (parede esquerda)
function Mural({ paineis, alvo }: { paineis: PainelMural[]; alvo: Alvo | null }) {
    const titulo = useTextura(() => texturaRotulo("Canais de texto"), "mural");
    if (paineis.length === 0) return null;

    return (
        <group>
            <mesh position={[-1.88, 1.62, 0]}>
                <boxGeometry args={[0.04, 1.95, 3.75]} />
                <meshStandardMaterial color={COR.moldura} roughness={0.9} />
            </mesh>
            <mesh position={[-1.85, 2.74, 0.85]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[2, 0.31]} />
                <meshBasicMaterial map={titulo} transparent toneMapped={false} />
            </mesh>
            {paineis.map((p) => (
                <PainelCanal key={p.canal.id} painel={p} destacado={alvo?.tipo === "mural" && alvo.canalId === p.canal.id} />
            ))}
        </group>
    );
}

function PainelCanal({ painel, destacado }: { painel: PainelMural; destacado: boolean }) {
    const textura = useTextura(() => texturaMural(painel.canal.nome, destacado), `${painel.canal.nome}|${destacado}`);
    return (
        <mesh
            position={[-1.845, painel.y, painel.z]}
            rotation={[0, Math.PI / 2, 0]}
            userData={{ alvo: { tipo: "mural", canalId: painel.canal.id } satisfies Alvo }}
        >
            <planeGeometry args={[painel.largura, painel.altura]} />
            <meshBasicMaterial map={textura} toneMapped={false} />
        </mesh>
    );
}

// quadro do andar, na parede direita: qual andar é e quem está em cada sala
function Quadro({ andar, servidorNome, planta, salas }: { andar: number; servidorNome: string; planta: Planta; salas: Map<string, InfoSala> }) {
    const lista = planta.salas.map((s) => ({ nome: s.canal.nome, pessoas: salas.get(s.canal.id)?.contagem ?? 0 }));
    const chave = `${andar}|${servidorNome}|${lista.map((s) => `${s.nome}:${s.pessoas}`).join(",")}`;
    const textura = useTextura(() => texturaQuadro(andar, servidorNome, lista), chave);

    return (
        <mesh position={[1.875, 1.6, -0.1]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[2.3, 2.3]} />
            <meshBasicMaterial map={textura} toneMapped={false} />
        </mesh>
    );
}

// o elevador: cabine, luz, painel de andares e as portas que abrem quando você chega
function Elevador({ andar, comandos, abertas }: { andar: number; comandos: RefObject<Comandos>; abertas: boolean }) {
    const { meiaLargura, frente, fundo } = ELEVADOR_PLANTA;
    const painel = useTextura(() => texturaPainelElevador(andar), String(andar));
    const esquerda = useRef<Mesh>(null);
    const direita = useRef<Mesh>(null);

    useFrame((_, dt) => {
        const c = comandos.current;
        c.portas += ((abertas ? 1 : 0) - c.portas) * Math.min(1, dt * 3.5);
        // cada folha encolhe pro seu lado (sem atravessar as paredes)
        const largura = meiaLargura * (1 - c.portas * 0.92);
        if (esquerda.current) {
            esquerda.current.scale.x = largura / meiaLargura;
            esquerda.current.position.x = -meiaLargura + largura / 2;
        }
        if (direita.current) {
            direita.current.scale.x = largura / meiaLargura;
            direita.current.position.x = meiaLargura - largura / 2;
        }
    });

    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, (frente + fundo) / 2]}>
                <planeGeometry args={[meiaLargura * 2, fundo - frente]} />
                <meshStandardMaterial color="#2a3f43" roughness={0.5} metalness={0.4} />
            </mesh>
            <pointLight position={[0, 2.6, (frente + fundo) / 2]} color={COR.luz} intensity={5} distance={5} decay={2} />
            <mesh position={[0, 2.8, frente]}>
                <boxGeometry args={[meiaLargura * 2, 0.4, 0.24]} />
                <meshStandardMaterial color={COR.elevador} roughness={0.4} metalness={0.5} />
            </mesh>
            {[esquerda, direita].map((ref, i) => (
                <mesh key={i} ref={ref} position={[i === 0 ? -meiaLargura / 2 : meiaLargura / 2, 1.3, frente + 0.14]}>
                    <boxGeometry args={[meiaLargura, 2.6, 0.06]} />
                    <meshStandardMaterial color={COR.portaElevador} roughness={0.3} metalness={0.75} />
                </mesh>
            ))}
            <mesh
                position={[meiaLargura - 0.125, 1.35, frente + 0.75]}
                rotation={[0, -Math.PI / 2, 0]}
                userData={{ alvo: { tipo: "elevador" } satisfies Alvo }}
            >
                <planeGeometry args={[0.28, 0.56]} />
                <meshBasicMaterial map={painel} toneMapped={false} />
            </mesh>
        </group>
    );
}
