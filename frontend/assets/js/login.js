document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const apiKeyInput = document.getElementById('api-key');
    const loginError = document.getElementById('login-error');
    const alertModal = document.getElementById('alert-modal');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertIconSymbol = document.getElementById('alert-icon-symbol');
    
    // Verificar se já temos a API key salva
    const savedApiKey = localStorage.getItem('hiveApiKey');
    if (savedApiKey) {
        // Verificar se a API key é válida
        verifyApiKey(savedApiKey)
            .then(isValid => {
                if (isValid) {
                    // Redirecionar para o painel
                    window.location.href = 'index.html';
                } else {
                    // Limpar a chave inválida
                    localStorage.removeItem('hiveApiKey');
                    showError('A chave salva é inválida. Por favor, faça login novamente.');
                }
            })
            .catch(err => {
                console.error('Erro ao verificar a API key:', err);
                showError('Erro ao validar a chave. Verifique se o servidor está online.');
            });
    }
    
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showError('Por favor, insira uma chave de API.');
            return;
        }
        
        // Verificar a API key com o servidor
        verifyApiKey(apiKey)
            .then(isValid => {
                if (isValid) {
                    // Salvar a API key no localStorage
                    localStorage.setItem('hiveApiKey', apiKey);
                    
                    // Redirecionar para o painel
                    window.location.href = 'index.html';
                } else {
                    showError('Chave de API inválida. Por favor, tente novamente.');
                }
            })
            .catch(err => {
                console.error('Erro ao verificar a API key:', err);
                showError('Erro ao validar a chave. Verifique se o servidor está online.');
            });
    });
    
    function showError(message, title = 'Erro', type = 'error') {
        // Configurar o ícone de acordo com o tipo
        alertIconSymbol.className = '';
        
        switch(type) {
            case 'success':
                alertIconSymbol.className = 'fas fa-check-circle';
                break;
            case 'warning':
                alertIconSymbol.className = 'fas fa-exclamation-triangle';
                break;
            case 'error':
                alertIconSymbol.className = 'fas fa-times-circle';
                break;
            default: // 'info'
                alertIconSymbol.className = 'fas fa-info-circle';
                break;
        }
        
        // Definir título e mensagem
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        
        // Mostrar o modal
        alertModal.classList.add('active');
        
        // Também manter a mensagem no elemento original
        loginError.textContent = message;
        loginError.style.display = 'block';
        
        apiKeyInput.focus();
    }
    
    // Adicionar event listeners para fechar modais
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    function verifyApiKey(apiKey) {
        // Fazer uma requisição para verificar o status da API com a chave fornecida
        return fetch('/api/status', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        })
        .then(response => {
            return response.ok;
        })
        .catch(err => {
            console.error('Erro na requisição:', err);
            return false;
        });
    }
});
