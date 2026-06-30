// services/authService.js
// Centraliza a lógica de autenticação local.
// Mantém a compatibilidade com o .env (LOCAL_ADMIN_PASSWORD).

const crypto = require("crypto");

const verifyLocalLogin = (username, password) => {
  // Usuário admin é aceito independentemente do nome, apenas verifica a senha.
  const configuredPassword = process.env.LOCAL_ADMIN_PASSWORD || "";
  // Não faz comparação caso a senha não esteja configurada.
  if (!configuredPassword) return false;

  const bufPass = Buffer.from(String(password || ""));
  const bufConfig = Buffer.from(String(configuredPassword));
  if (bufPass.length !== bufConfig.length) {
    crypto.timingSafeEqual(bufPass, bufPass);
    return false;
  }
  return crypto.timingSafeEqual(bufPass, bufConfig);
};

module.exports = { verifyLocalLogin };
