# application-loopback (binários do Windows)

Copiados do pacote npm [application-loopback](https://github.com/WerdoxDev/application-loopback) 1.2.7 (MIT, ver LICENSE).
Usados por `src/somWindows.ts`; o electron-builder põe esta pasta nos recursos do app do Windows.

- `ProcessList.exe`: lista as janelas visíveis, uma por linha: `pid;hwnd;título`
- `ApplicationLoopback.exe <pid>`: captura o som desse processo (e dos filhos) e escreve na saída
  padrão em PCM 16 bits little-endian, estéreo, 48 kHz, até ser encerrado

Ficam aqui em vez do pacote porque ele pede TypeScript 5 como peerDependency (o projeto usa o 7).
