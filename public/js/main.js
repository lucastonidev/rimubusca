/**
 * ==============================================================================
 * RIMUBUSCA - MAIN FRONTEND SCRIPT (MAIN.JS)
 * Inicialização, Gerenciamento de Tema, Sidebar, Atalho Ctrl+K e Navegação
 * ==============================================================================
 */

const initMain = () => {
  // 1. INICIALIZAÇÃO DE ÍCONES LUCIDE
  const renderLucide = () => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  };
  window.renderLucide = renderLucide;
  renderLucide();
  window.addEventListener('load', renderLucide);
  setTimeout(renderLucide, 250);
  setTimeout(renderLucide, 800);

  // 2. GERENCIADOR DE TEMA (DARK / LIGHT)
  const initTheme = () => {
    const savedTheme = window.rimuSettings ? window.rimuSettings.theme : (localStorage.getItem('rimu_theme') || 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        if (window.rimuSettings) {
          window.rimuSettings.set('theme', newTheme);
        } else {
          localStorage.setItem('rimu_theme', newTheme);
        }
        updateThemeIcon(newTheme);
      });
    }
  };

  const updateThemeIcon = (theme) => {
    const iconElem = document.getElementById('themeToggleIcon');
    if (iconElem) {
      iconElem.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
      if (window.lucide) window.lucide.createIcons({ root: iconElem.parentElement });
    }
  };

  initTheme();

  // 3. CONTROLE DE EXPANDIR E REDUZIR A SIDEBAR (DESKTOP & MOBILE)
  const sidebar = document.getElementById('appSidebar');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebarToggleIcon = document.getElementById('sidebarToggleIcon');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  const updateToggleIcon = (isCollapsed) => {
    if (sidebarToggleIcon) {
      sidebarToggleIcon.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
      if (window.lucide) window.lucide.createIcons({ root: sidebarToggleIcon.parentElement });
    }
  };

  const toggleSidebar = () => {
    if (!sidebar) return;

    if (window.innerWidth <= 768) {
      // Mobile: abre ou fecha gaveta
      const isOpen = sidebar.classList.toggle('mobile-open');
      if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active', isOpen);
    } else {
      // Desktop: expande ou reduz largura
      const isCollapsed = sidebar.classList.toggle('collapsed');
      localStorage.setItem('rimu_sidebar_collapsed', isCollapsed);
      updateToggleIcon(isCollapsed);
    }
  };

  if (sidebar) {
    const isCollapsed = localStorage.getItem('rimu_sidebar_collapsed') === 'true';
    if (isCollapsed && window.innerWidth > 768) {
      sidebar.classList.add('collapsed');
      updateToggleIcon(true);
    }
  }

  sidebarToggleBtn?.addEventListener('click', toggleSidebar);
  mobileMenuBtn?.addEventListener('click', toggleSidebar);

  // 4. MENU GAVETA MOBILE BACKDROP
  const closeMobileSidebar = () => {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
  };

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', closeMobileSidebar);
  }

  // 5. COMMAND PALETTE GLOBAL (CTRL + K / CMD + K)
  const cmdBackdrop = document.getElementById('cmdPaletteModal');
  const cmdInput = document.getElementById('cmdPaletteInput');
  const cmdList = document.getElementById('cmdPaletteList');
  const cmdTriggerBtns = document.querySelectorAll('.search-trigger-btn');

  const openCommandPalette = () => {
    if (!cmdBackdrop) return;
    cmdBackdrop.classList.add('active');
    if (cmdInput) {
      cmdInput.value = '';
      cmdInput.focus();
      filterCommands('');
    }
  };

  const closeCommandPalette = () => {
    if (!cmdBackdrop) return;
    cmdBackdrop.classList.remove('active');
  };

  cmdTriggerBtns.forEach((btn) => btn.addEventListener('click', openCommandPalette));

  // Atalhos de teclado
  window.addEventListener('keydown', (e) => {
    // Ctrl+K ou Cmd+K abre a paleta
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (cmdBackdrop?.classList.contains('active')) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    }

    // Escape fecha modais abertos
    if (e.key === 'Escape') {
      closeCommandPalette();
      closeMobileSidebar();
      const jsonModal = document.getElementById('jsonModalBackdrop');
      if (jsonModal) jsonModal.classList.remove('active');
    }
  });

  // Fechar clicando no fundo da paleta
  if (cmdBackdrop) {
    cmdBackdrop.addEventListener('click', (e) => {
      if (e.target === cmdBackdrop) closeCommandPalette();
    });
  }

  // Filtro de Comandos na Paleta
  const filterCommands = (query) => {
    if (!cmdList) return;
    const items = cmdList.querySelectorAll('.cmd-palette-item');
    const term = query.trim().toLowerCase();

    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      if (!term || text.includes(term)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  };

  if (cmdInput) {
    cmdInput.addEventListener('input', (e) => {
      filterCommands(e.target.value);
    });
  }

  // 6. DESTAQUE DA ROTA ATIVA NA SIDEBAR E BOTTOM-NAV
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-item, .bottom-nav-item');

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href === currentPath || (href !== '/dashboard' && currentPath.startsWith(href))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMain);
} else {
  initMain();
}

