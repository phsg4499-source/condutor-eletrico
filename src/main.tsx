import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// eslint-disable-next-line no-console
console.log(
  '%cCondutor Elétrico Brasil%c\nSistema desenvolvido por Simplifica Seguros.\n© ' +
    new Date().getFullYear() +
    ' Simplifica Seguros. Todos os direitos reservados.\nCódigo e design protegidos por direitos autorais — reprodução, cópia ou redistribuição não autorizadas são proibidas.',
  'color:#0069A8;font-weight:bold;font-size:14px;',
  'color:inherit;font-weight:normal;',
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
