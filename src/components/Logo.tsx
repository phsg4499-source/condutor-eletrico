// Identidade visual oficial da Condutor Elétrico Brasil (logomarca fornecida pelo cliente).
// Duas variantes de raster: "claro" tem o texto em branco (para fundos escuros/azuis) e
// "escuro" tem o texto em azul-marinho (para fundos claros/brancos) — nunca deformada,
// esticada ou comprimida (sempre com object-fit: contain e proporção original preservada).
// O símbolo isolado (ícone pequeno, ex.: aba lateral recolhida) usa um traço vetorial próprio,
// já que o anel da logomarca real está interligado ao texto na arte fornecida.

const LOGO_SRC = {
  claro: '/brand/logo-horizontal-claro.png', // texto branco — fundos escuros
  escuro: '/brand/logo-horizontal-escuro.png', // texto azul-marinho — fundos claros
};

interface LogoProps {
  variant?: 'horizontal' | 'vertical' | 'symbol';
  theme?: 'dark' | 'light';
  className?: string;
  animated?: boolean;
}

export function LogoSymbol({ theme = 'dark', className, animated = false }: { theme?: 'dark' | 'light'; className?: string; animated?: boolean }) {
  const stroke = theme === 'dark' ? '#ffffff' : '#0b2338';
  const accent = '#00B4E5';
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Símbolo Condutor Elétrico Brasil">
      <path
        d="M72 24 A34 34 0 1 0 72 76"
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M50 30 L38 50 L50 50 L42 70"
        fill="none"
        stroke={accent}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? 'ce-energy-path' : undefined}
      />
      <circle cx="50" cy="30" r="4.5" fill={accent} className={animated ? 'ce-glow-pulse' : undefined} />
      <circle cx="42" cy="70" r="4.5" fill={accent} className={animated ? 'ce-glow-pulse' : undefined} />
    </svg>
  );
}

export default function Logo({ variant = 'horizontal', theme = 'dark', className, animated = false }: LogoProps) {
  if (variant === 'symbol') return <LogoSymbol theme={theme} className={className} animated={animated} />;

  const src = theme === 'dark' ? LOGO_SRC.claro : LOGO_SRC.escuro;
  const alt = 'Condutor Elétrico Brasil';

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center ${className ?? ''}`}>
        <img src={src} alt={alt} className="max-w-[220px] w-full h-auto object-contain" />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className ?? ''}`}>
      <img src={src} alt={alt} className="h-9 w-auto object-contain" style={{ maxWidth: 220 }} />
    </div>
  );
}
