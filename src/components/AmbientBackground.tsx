// Fundo decorativo com "blobs" de energia flutuantes, usado nas telas públicas.
export default function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="ce-blob absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#f5c518]/10 blur-3xl" />
      <div className="ce-blob ce-blob-delay absolute top-1/3 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#f5c518]/[0.07] blur-3xl" />
      <div className="ce-blob absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-blue-500/[0.06] blur-3xl" />
    </div>
  );
}
