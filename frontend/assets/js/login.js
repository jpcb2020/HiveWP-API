document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const apiKeyInput = document.getElementById('api-key');
    const loginError = document.getElementById('login-error');
    
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
    
    function showError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
        apiKeyInput.focus();
    }
    
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
