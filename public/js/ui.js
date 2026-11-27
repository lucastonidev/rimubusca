/**
 * ==============================================================================
 * RIMUBUSCA - UI HELPERS (UI.JS)
 * Gerenciamento de Toasts, Modais, Área de Transferência e Máscaras de Entrada
 * ==============================================================================
 */

// 1. SISTEMA GLOBAL DE TOAST NOTIFICATIONS
class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  show({ type = 'info', title = '', message = '', duration = 4000 }) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width: 20px; height: 20px; flex-shrink: 0; margin-top: 2px;"></i>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-msg">${message}</div>
      </div>
      <button class="toast-close" aria-label="Fechar notificação">
        <i data-lucide="x" style="width: 14px; height: 14px;"></i>
      </button>
    `;

    this.container.appendChild(toast);

    if (window.lucide) {
      window.lucide.createIcons({ root: toast });
    }

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => {
        if (toast.parentElement) toast.remove();
      }, 200);
    };

    closeBtn.addEventListener('click', dismiss);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  success(message, title = 'Sucesso') {
    this.show({ type: 'success', title, message });
  }

  error(message, title = 'Erro') {
    this.show({ type: 'error', title, message, duration: 6000 });
  }

  info(message, title = 'Informação') {
    this.show({ type: 'info', title, message });
  }
}

window.toast = new ToastManager();

// 2. HELPER DE CÓPIA PARA O CLIPBOARD
window.copyToClipboard = async function (text, btnOrMessage = null, maybeCustomMessage = null) {
  try {
    if (!text && text !== 0) return;

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(String(text));
    } else {
      // Fallback para navegadores legados ou sem contexto seguro
      const textArea = document.createElement('textarea');
      textArea.value = String(text);
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }

    let btnElement = null;
    let customMessage = null;

    if (btnOrMessage instanceof HTMLElement || (btnOrMessage && typeof btnOrMessage === 'object' && btnOrMessage.nodeType === 1)) {
      btnElement = btnOrMessage;
      customMessage = typeof maybeCustomMessage === 'string' ? maybeCustomMessage : null;
    } else if (typeof btnOrMessage === 'string') {
      customMessage = btnOrMessage;
    }

    if (btnElement) {
      const originalHTML = btnElement.innerHTML;
      btnElement.innerHTML = `
        <i data-lucide="check" style="width: 14px; height: 14px; color: var(--color-success);"></i>
        <span>Copiado!</span>
      `;
      if (window.lucide) window.lucide.createIcons({ root: btnElement });

      setTimeout(() => {
        btnElement.innerHTML = originalHTML;
        if (window.lucide) window.lucide.createIcons({ root: btnElement });
      }, 1800);
    }

    const shortText = String(text).length > 30 ? String(text).slice(0, 30) + '...' : String(text);
    const msg = customMessage || `"${shortText}" copiado com sucesso!`;
    window.toast?.success(msg, 'Copiado');
  } catch (err) {
    console.error('Falha ao copiar texto:', err);
    window.toast?.error('Não foi possível copiar para a área de transferência.');
  }
};

// 3. MÁSCARAS DE ENTRADA (Mundo Real & Prevenção de Erros - Nielsen #2 e #5)
window.masks = {
  telefone(value) {
    if (!value) return '';
    const raw = String(value).trim();
    let clean = raw.replace(/\D/g, '');
    if ((raw.startsWith('+55') || (clean.length >= 12 && clean.length <= 13)) && clean.startsWith('55')) {
      clean = clean.slice(2);
    }
    if (clean.startsWith('0') && clean.length >= 11) {
      clean = clean.slice(1);
    }
    if (clean.length > 11) clean = clean.slice(0, 11);

    if (clean.length > 10) {
      return clean.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (clean.length > 5) {
      return clean.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (clean.length > 2) {
      return clean.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else {
      return clean;
    }
  },

  cpf(value) {
    if (!value) return '';
    let clean = value.replace(/\D/g, '');
    if (clean.length > 11) clean = clean.slice(0, 11);

    if (clean.length > 9) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    } else if (clean.length > 6) {
      return clean.replace(/^(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (clean.length > 3) {
      return clean.replace(/^(\d{3})(\d{1,3})/, '$1.$2');
    } else {
      return clean;
    }
  },
};

