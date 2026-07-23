import { useEffect, useRef, useState } from 'react';

// Pequena animação de contagem para números do dashboard (efeito de "movimento").
export default function CountUp({ value, formatter, durationMs = 700 }: {
  value: number; formatter?: (n: number) => string; durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    let raf: number;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(fromRef.current + (value - fromRef.current) * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  const rounded = Math.round(display);
  return <span className="ce-count-tick">{formatter ? formatter(rounded) : rounded}</span>;
}
