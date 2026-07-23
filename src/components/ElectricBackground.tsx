// Fundo animado de "correntes elétricas" para telas de alto impacto (login) e, em versão
// discreta ("subtle"), para o restante do sistema — um movimento quase imperceptível
// passando atrás do conteúdo, sem atrapalhar a leitura das telas de trabalho.
export default function ElectricBackground({ subtle = false }: { subtle?: boolean }) {
  const lines = [
    { d: 'M -50 120 L 260 120 L 300 170 L 620 170 L 660 220 L 1250 220', duration: 7, delay: 0, opacity: 0.55 },
    { d: 'M -50 620 L 220 620 L 260 570 L 540 570 L 580 520 L 1250 520', duration: 8.5, delay: 1.2, opacity: 0.45 },
    { d: 'M -50 380 L 180 380 L 220 340 L 480 340 L 520 300 L 900 300 L 940 260 L 1250 260', duration: 9.5, delay: 2.4, opacity: 0.5 },
    { d: 'M -50 720 L 320 720 L 360 680 L 760 680 L 800 640 L 1250 640', duration: 6.5, delay: 0.6, opacity: 0.4 },
    { d: 'M -50 60 L 400 60 L 440 100 L 900 100 L 940 140 L 1250 140', duration: 10, delay: 3, opacity: 0.35 },
  ];
  const gradId = subtle ? 'ce-line-grad-subtle' : 'ce-line-grad';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className={`ce-grid-bg absolute inset-0 ${subtle ? 'opacity-[0.12]' : 'opacity-60'}`} />
      <svg viewBox="0 0 1200 800" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f5c518" stopOpacity="0" />
            <stop offset="50%" stopColor="#f5c518" stopOpacity={subtle ? 0.35 : 0.9} />
            <stop offset="100%" stopColor="#f5c518" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lines.map((line, i) => (
          <path
            key={i}
            d={line.d}
            className="ce-current-line"
            stroke={`url(#${gradId})`}
            strokeWidth={i === 2 ? 2 : 1.4}
            style={{ opacity: subtle ? line.opacity * 0.3 : line.opacity, animationDuration: `${line.duration}s`, animationDelay: `${line.delay}s` }}
          />
        ))}
      </svg>
      {!subtle && (
        <>
          <div className="ce-blob absolute -top-24 -left-16 w-[26rem] h-[26rem] rounded-full bg-[#f5c518]/10 blur-3xl" />
          <div className="ce-blob ce-blob-delay absolute bottom-0 -right-16 w-[30rem] h-[30rem] rounded-full bg-blue-500/[0.08] blur-3xl" />
        </>
      )}
    </div>
  );
}
