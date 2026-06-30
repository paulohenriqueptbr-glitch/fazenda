const express = require('express');
const router = express.Router();
const { verifyLocalLogin } = require('../services/authService');

router.post('/local-login', (req, res) => {
  const { username, password } = req.body;
  const ok = verifyLocalLogin(username, password);

  if (ok) {
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ ok: false, message: 'Usuário ou senha incorretos.' });
  }
});

module.exports = router;
