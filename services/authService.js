// services/authService.js
// Centraliza a lógica de autenticação local.
// Mantém a compatibilidade com o .env (LOCAL_ADMIN_PASSWORD).

const verifyLocalLogin = (username, password) => {
  // Usuário admin é aceito independentemente do nome, apenas verifica a senha.
  const configuredPassword = process.env.LOCAL_ADMIN_PASSWORD || '';
  // Não faz comparação caso a senha não esteja configurada.
  if (!configuredPassword) return false;
  return password === configuredPassword;
};

module.exports = { verifyLocalLogin };
