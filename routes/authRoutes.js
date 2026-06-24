// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { verifyLocalLogin } = require('../services/authService');

// POST /api/local-login
router.post('/local-login', (req, res) => {
  console.log('Tentativa de login local recebida via router. Body:', req.body);
  const { username, password } = req.body;
  const ok = verifyLocalLogin(username, password);

  if (ok) {
    console.log('✅ Login local via router bem-sucedido');
    res.status(200).json({ ok: true });
  } else {
    console.log('❌ Login local via router falhou');
    res.status(401).json({ ok: false, message: 'Usuário ou senha incorretos.' });
  }
});

module.exports = router;
