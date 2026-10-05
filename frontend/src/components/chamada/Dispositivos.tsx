import { useMediaDeviceSelect } from "@livekit/components-react";

type Selecao = ReturnType<typeof useMediaDeviceSelect>;

// escolha de microfone, câmera e saída de som durante a chamada
export function Dispositivos() {
    const microfones = useMediaDeviceSelect({ kind: "audioinput" });
    const cameras = useMediaDeviceSelect({ kind: "videoinput" });
    // o Firefox não deixa escolher a saída de som, então essa lista pode vir vazia
    const saidas = useMediaDeviceSelect({ kind: "audiooutput" });

    const nenhum = microfones.devices.length + cameras.devices.length + saidas.devices.length === 0;

    return (
        <div className="dispositivos">
            {nenhum ? (
                <p className="dispositivos-vazio">
                    Nenhum dispositivo liberado. Permita o acesso ao microfone e à câmera nas configurações do navegador.
                </p>
            ) : (
                <>
                    <Seletor selecao={microfones} rotulo="Microfone" />
                    <Seletor selecao={cameras} rotulo="Câmera" />
                    <Seletor selecao={saidas} rotulo="Saída de som" />
                </>
            )}
        </div>
    );
}

function Seletor({ selecao, rotulo }: { selecao: Selecao; rotulo: string }) {
    const { devices, activeDeviceId, setActiveMediaDevice } = selecao;
    if (devices.length === 0) return null;

    return (
        <label className="dispositivo">
            <span className="rotulo">{rotulo}</span>
            <select value={activeDeviceId} onChange={(e) => setActiveMediaDevice(e.target.value)}>
                {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "Dispositivo sem nome"}
                    </option>
                ))}
            </select>
        </label>
    );
}
