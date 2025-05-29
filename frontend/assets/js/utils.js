/**
 * Utilitários compartilhados para o HiveWP Frontend
 * Centraliza funções comuns para evitar duplicação de código
 */

// Configuração global
const HiveUtils = {
    // Configurações da API
    apiConfig: {
        baseUrl: localStorage.getItem('apiUrl') || 'http://localhost:3000',
        get headers() {
            const apiKey = localStorage.getItem('hiveApiKey');
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
        }
    },

    // Verificação de autenticação
    auth: {
        check() {
            const apiKey = localStorage.getItem('hiveApiKey');
            if (!apiKey) {
                this.redirectToLogin();
                return false;
            }
            return true;
        },

        async verify() {
            const apiKey = localStorage.getItem('hiveApiKey');
            if (!apiKey) return false;

            try {
                const response = await fetch('/api/status', {
                    headers: { 'Authorization': `Bearer ${apiKey}` }
                });
                return response.ok;
            } catch {
                return false;
            }
        },

        logout() {
            localStorage.removeItem('hiveApiKey');
            this.redirectToLogin();
        },

        redirectToLogin() {
            window.location.href = '/login.html';
        }
    },

    // Gerenciamento de modais unificado
    modal: {
        show(modal) {
            if (typeof modal === 'string') {
                modal = document.getElementById(modal);
            }
            if (modal) {
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('show'), 10);
            }
        },

        hide(modal) {
            if (typeof modal === 'string') {
                modal = document.getElementById(modal);
            }
            if (modal) {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            }
        },

        close(modalElement) {
            const modal = modalElement.closest('.modal');
            if (modal) {
                this.hide(modal);
            }
        }
    },

    // Sistema de alertas unificado
    alert: {
        show(title, message, type = 'info') {
            const alertModal = document.getElementById('alert-modal');
            const alertTitle = document.getElementById('alert-title');
            const alertMessage = document.getElementById('alert-message');
            const iconSymbol = document.getElementById('alert-icon-symbol');

            if (!alertModal || !alertTitle || !alertMessage || !iconSymbol) {
                console.warn('Elementos de modal de alerta não encontrados');
                return;
            }

            // Configurar ícone
            const iconClasses = {
                success: 'fas fa-check-circle',
                warning: 'fas fa-exclamation-triangle',
                error: 'fas fa-times-circle',
                info: 'fas fa-info-circle'
            };

            iconSymbol.className = iconClasses[type] || iconClasses.info;
            alertTitle.textContent = title;
            alertMessage.textContent = message;

            HiveUtils.modal.show(alertModal);
        },

        success(title, message) {
            this.show(title, message, 'success');
        },

        error(title, message) {
            this.show(title, message, 'error');
        },

        warning(title, message) {
            this.show(title, message, 'warning');
        },

        info(title, message) {
            this.show(title, message, 'info');
        }
    },

    // Sistema de confirmação unificado
    confirm: {
        show(message, title = 'Confirmação') {
            return new Promise((resolve) => {
                const confirmModal = document.getElementById('confirm-modal');
                const confirmTitle = document.getElementById('confirm-title');
                const confirmMessage = document.getElementById('confirm-message');
                const headerTitle = document.getElementById('confirm-header-title');

                if (!confirmModal) {
                    console.warn('Modal de confirmação não encontrado');
                    resolve(false);
                    return;
                }

                // Configurar conteúdo
                if (confirmTitle) confirmTitle.textContent = title;
                if (headerTitle) headerTitle.textContent = title;
                if (confirmMessage) confirmMessage.textContent = message;

                // Limpar eventos anteriores
                const closeButtons = confirmModal.querySelectorAll('.close-confirm');
                closeButtons.forEach(btn => {
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);
                });

                // Mostrar modal
                HiveUtils.modal.show(confirmModal);

                // Configurar eventos
                confirmModal.querySelectorAll('.close-confirm').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const result = this.getAttribute('data-result') === 'true';
                        HiveUtils.modal.hide(confirmModal);
                        resolve(result);
                    }, { once: true });
                });
            });
        }
    },

    // Requisições HTTP otimizadas
    http: {
        async request(url, options = {}) {
            if (!HiveUtils.auth.check()) {
                return null;
            }

            const finalOptions = {
                ...options,
                headers: {
                    ...HiveUtils.apiConfig.headers,
                    ...(options.headers || {})
                }
            };

            try {
                const response = await fetch(url, finalOptions);
                
                if (response.status === 401) {
                    HiveUtils.auth.logout();
                    return null;
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            } catch (error) {
                console.error('Erro na requisição:', error);
                throw error;
            }
        },

        async get(url) {
            return this.request(url);
        },

        async post(url, data) {
            return this.request(url, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        async put(url, data) {
            return this.request(url, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        },

        async delete(url) {
            return this.request(url, {
                method: 'DELETE'
            });
        }
    },

    // Utilitários diversos
    utils: {
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        formatDate(date) {
            return new Date(date).toLocaleString('pt-BR');
        },

        getUrlParam(param) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(param);
        },

        showLoading(element) {
            if (typeof element === 'string') {
                element = document.getElementById(element);
            }
            if (element) {
                element.innerHTML = `
                    <div style="text-align: center; margin: 20px 0;">
                        <div class="spinner"></div>
                        <p style="margin-top: 10px;">Carregando...</p>
                    </div>
                `;
            }
        }
    }
};

// Inicialização automática de eventos comuns
document.addEventListener('DOMContentLoaded', function() {
    // Configurar fechamento de modais
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            HiveUtils.modal.close(e.target);
        });
    });

    // Verificar autenticação automática se não estivermos na página de login
    if (!window.location.pathname.includes('login.html')) {
        HiveUtils.auth.verify().then(isValid => {
            if (!isValid && HiveUtils.auth.check()) {
                HiveUtils.auth.logout();
            }
        });
    }
});

// Exportar para uso global
window.HiveUtils = HiveUtils; 