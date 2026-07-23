// Identidade visual original da Condutor Elétrico.
// Símbolo: um "C" formado por um traço de circuito que conduz um pulso de energia,
// terminando em um nó (ponto de conexão), remetendo à condução de eletricidade com precisão.

interface LogoProps {
  variant?: 'horizontal' | 'vertical' | 'symbol';
  theme?: 'dark' | 'light';
  className?: string;
  animated?: boolean;
}

export function LogoSymbol({ theme = 'dark', className, animated = false }: { theme?: 'dark' | 'light'; className?: string; animated?: boolean }) {
  const stroke = theme === 'dark' ? '#f5f6f8' : '#16181d';
  const accent = '#f5c518';
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Símbolo Condutor Elétrico">
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
  const textColor = theme === 'dark' ? '#f5f6f8' : '#16181d';
  const subColor = theme === 'dark' ? '#a8adba' : '#565c68';

  if (variant === 'symbol') return <LogoSymbol theme={theme} className={className} animated={animated} />;

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
        <LogoSymbol theme={theme} className="w-14 h-14" animated={animated} />
        <div className="text-center leading-tight">
          <div className="font-extrabold tracking-tight text-lg" style={{ color: textColor }}>CONDUTOR</div>
          <div className="font-extrabold tracking-tight text-lg -mt-1" style={{ color: '#f5c518' }}>ELÉTRICO</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <LogoSymbol theme={theme} className="w-10 h-10 shrink-0" animated={animated} />
      <div className="leading-tight">
        <div className="font-extrabold tracking-tight text-base" style={{ color: textColor }}>
          CONDUTOR <span style={{ color: '#f5c518' }}>ELÉTRICO</span>
        </div>
        <div className="text-[10px] uppercase tracking-widest" style={{ color: subColor }}>Serviços elétricos</div>
      </div>
    </div>
  );
}
