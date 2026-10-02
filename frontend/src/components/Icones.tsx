type Props = { tamanho?: number };

function Svg({ tamanho = 20, children }: Props & { children: React.ReactNode }) {
    return (
        <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {children}
        </svg>
    );
}

export const IconeHash = (p: Props) => (
    <Svg {...p}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></Svg>
);

export const IconeVoz = (p: Props) => (
    <Svg {...p}>
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
    </Svg>
);

export const IconeMais = (p: Props) => (
    <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);

export const IconeSair = (p: Props) => (
    <Svg {...p}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
    </Svg>
);

export const IconeConvidar = (p: Props) => (
    <Svg {...p}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M19 8v6M22 11h-6" />
    </Svg>
);

export const IconeCoroa = (p: Props) => (
    <Svg {...p}><path d="m2 7 5 5 5-8 5 8 5-5-2 12H4L2 7z" /></Svg>
);

export const IconeX = (p: Props) => (
    <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>
);

export const IconeMembros = (p: Props) => (
    <Svg {...p}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
);
