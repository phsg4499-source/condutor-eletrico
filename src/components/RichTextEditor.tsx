import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Heading3, Pilcrow } from 'lucide-react';

// Editor de texto rico usado nas seções de texto livre da "Proposta técnica completa"
// (apresentação, laudo técnico, escopo, encerramento etc.). Schema propositalmente restrito —
// só parágrafo, título (h3), negrito, itálico e listas — sem imagem/tabela/link. Isso mantém o
// HTML gerado simples e previsível tanto para o PDF (ver src/lib/richTextPdf.ts) quanto para a
// exibição somente-leitura (readOnly) na Revisão e na página pública, que nunca usa
// dangerouslySetInnerHTML — sempre outra instância deste mesmo editor, só sem edição habilitada.
interface RichTextEditorProps {
  value: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, readOnly, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3] } })],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class: readOnly
          ? 'ce-richtext text-[#0b2338]'
          : 'ce-richtext text-[#0b2338] min-h-[110px] focus:outline-none px-3 py-2',
      },
    },
  }, [readOnly]);

  if (!editor) return null;

  if (readOnly) {
    const isEmpty = editor.isEmpty;
    if (isEmpty) return <p className="text-xs text-slate-400 italic">Não preenchido.</p>;
    return <EditorContent editor={editor} />;
  }

  return (
    <div className="rounded-lg bg-white border border-slate-200 overflow-hidden focus-within:border-[#00B4E5]">
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5 bg-slate-50">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Negrito"><Bold size={13} /></ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Itálico"><Italic size={13} /></ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="Título"><Heading3 size={13} /></ToolbarButton>
        <ToolbarButton active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} label="Parágrafo"><Pilcrow size={13} /></ToolbarButton>
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Lista com marcadores"><List size={13} /></ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Lista numerada"><ListOrdered size={13} /></ToolbarButton>
      </div>
      <EditorContent editor={editor} onClick={() => editor.chain().focus()} />
      {placeholder && editor.isEmpty && (
        <p className="px-3 pb-2 -mt-8 pointer-events-none text-xs text-slate-400">{placeholder}</p>
      )}
    </div>
  );
}

function ToolbarButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label}
      className={`p-1.5 rounded ${active ? 'bg-[#00B4E5] text-[#0b2338]' : 'text-slate-500 hover:bg-slate-200'}`}>
      {children}
    </button>
  );
}
