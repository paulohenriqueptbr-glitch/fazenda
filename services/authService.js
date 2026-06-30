const crypto = require("crypto");

const verifyLocalLogin = (username, password) => {
  const configuredPassword = process.env.LOCAL_ADMIN_PASSWORD || "";
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
