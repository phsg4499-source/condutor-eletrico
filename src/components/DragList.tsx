import { useState } from 'react';
import { GripVertical } from 'lucide-react';

// Lista genérica reordenável por arraste (drag-and-drop nativo do navegador, sem dependência
// nova). Usada para ambientes e para as atividades dentro de cada ambiente na proposta técnica
// completa. O "handle" (ícone de grip) é o único elemento arrastável — evita conflito com cliques
// em inputs/botões dentro do próprio item.
interface DragListProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export default function DragList<T>({ items, onReorder, getKey, renderItem, className }: DragListProps<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null); setOverIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorder(next);
    setDragIndex(null); setOverIndex(null);
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={getKey(item)}
          onDragOver={e => { e.preventDefault(); if (dragIndex !== null) setOverIndex(index); }}
          onDrop={e => { e.preventDefault(); handleDrop(index); }}
          className={`flex items-start gap-1.5 ${overIndex === index && dragIndex !== null && dragIndex !== index ? 'ring-2 ring-[#00B4E5] rounded-lg' : ''}`}>
          <span
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
            title="Arraste para reordenar"
            className="mt-2 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0">
            <GripVertical size={15} />
          </span>
          <div className="flex-1 min-w-0">{renderItem(item, index)}</div>
        </div>
      ))}
    </div>
  );
}
