/**
 * ==============================================================================
 * RIMUBUSCA - GERENCIADOR DE HISTÓRICO (HISTORICO.JS)
 * Manipulação de consultas recentes no frontend e integração com o backend
 * ==============================================================================
 */

window.historico = {
  /**
   * Exclui um registro individual do histórico
   */
  async deleteItem(id, btnElement = null) {
    if (!confirm('Deseja remover este registro do seu histórico de buscas?')) {
      return;
    }

    try {
      if (btnElement) btnElement.disabled = true;

      await window.api.delete(`/api/historico/${id}`);

      // Remove a linha da tabela com animação suave
      const row = document.getElementById(`historico-row-${id}`);
      if (row) {
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        row.style.transition = 'all 0.25s ease';
        setTimeout(() => {
          row.remove();
          // Se a tabela estiver vazia, exibe empty state
          const tbody = document.querySelector('.osint-table tbody');
          if (tbody && tbody.children.length === 0) {
            window.location.reload();
          }
        }, 250);
      }

      window.toast.success('Registro removido do histórico com sucesso.');
    } catch (err) {
      console.error('Erro ao excluir histórico:', err);
      if (btnElement) btnElement.disabled = false;
    }
  },

  /**
   * Limpa todo o histórico de buscas do usuário autenticado
   */
  async clearAll() {
    if (!confirm('ATENÇÃO: Deseja apagar TODO o seu histórico de consultas? Esta ação é irreversível.')) {
      return;
    }

    try {
      await window.api.delete('/api/historico');
      window.toast.success('Seu histórico de buscas foi totalmente limpo.');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      console.error('Erro ao limpar histórico:', err);
    }
  },

  /**
   * Abre modal simples para visualização do JSON do resultado
   */
  viewJson(jsonString) {
    try {
      const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      const formatted = JSON.stringify(parsed, null, 2);
      
      const modalBackdrop = document.getElementById('jsonModalBackdrop');
      const modalContent = document.getElementById('jsonModalCode');
      
      if (modalBackdrop && modalContent) {
        modalContent.textContent = formatted;
        modalBackdrop.classList.add('active');
      } else {
        // Fallback rápido
        alert(formatted);
      }
    } catch {
      window.toast.error('Não foi possível formatar os dados de resultado.');
    }
  }
};

