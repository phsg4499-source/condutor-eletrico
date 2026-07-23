import { useEffect, useState } from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';

// Mostra um aviso discreto (só em celular) ensinando a instalar o sistema como aplicativo.
// - Android/Chrome/Edge: dispara o prompt nativo de instalação (evento beforeinstallprompt).
// - iOS/Safari: não existe prompt nativo, então mostramos o passo a passo manual
//   (Compartilhar → Adicionar à Tela de Início), que é como o iOS instala PWAs.
// Não aparece se o app já estiver instalado, nem em telas de desktop.

const DISMISS_KEY = 'ce-install-prompt-dismissed-at';
const DISMISS_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function wasDismissedRecently() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return days < DISMISS_DAYS;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently() || !isMobile()) return;

    if (isIOS()) {
      // iOS nunca dispara beforeinstallprompt — mostramos direto as instruções manuais.
      setVisible(true);
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIosSteps(false);
  }

  async function handleInstallClick() {
    if (isIOS()) {
      setShowIosSteps(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm ce-toast-in">
      <div className="ce-glass-card rounded-2xl p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-[#f5c518]/15 border border-[#f5c518]/25 flex items-center justify-center shrink-0">
          <Download size={18} className="text-[#f5c518]" />
        </div>
        <div className="flex-1 min-w-0">
          {!showIosSteps ? (
            <>
              <p className="text-sm font-semibold text-white">Instalar como aplicativo</p>
              <p className="text-xs text-gray-400 mt-1">
                Adicione o Condutor Elétrico na tela do seu celular para abrir como um app, mais rápido e sem precisar do navegador.
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={handleInstallClick} className="ce-btn-glow flex-1 bg-[#f5c518] text-[#16181d] font-semibold text-xs px-3 py-2 rounded-lg hover:bg-[#e0b60f]">
                  Instalar agora
                </button>
                <button onClick={dismiss} className="text-xs text-gray-400 px-3 py-2 hover:text-white">Agora não</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Como instalar no iPhone/iPad</p>
              <ol className="text-xs text-gray-400 mt-2 space-y-1.5">
                <li className="flex items-center gap-1.5">
                  1. Toque no ícone <Share size={13} className="text-gray-300 inline" /> "Compartilhar" na barra do Safari.
                </li>
                <li className="flex items-center gap-1.5">
                  2. Escolha <PlusSquare size={13} className="text-gray-300 inline" /> "Adicionar à Tela de Início".
                </li>
                <li>3. Toque em "Adicionar". Pronto — o ícone aparece na sua tela como um app.</li>
              </ol>
              <button onClick={dismiss} className="text-xs text-gray-400 mt-3 hover:text-white">Entendi</button>
            </>
          )}
        </div>
        <button onClick={dismiss} className="text-gray-500 hover:text-white shrink-0" aria-label="Fechar">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
