// api/push-notify.js
// Endpoint para disparar notificações push
// Chamado internamente pelo cron ou pelo próprio app

import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:' + (process.env.SUPPORT_EMAIL || 'suporte@fazenda.app'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  // Só aceita POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Autenticação simples via Bearer token (mesmo segredo do local-login)
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token || token !== process.env.NOTIFY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { subscription, payload } = req.body;

  if (!subscription || !payload) {
    return res.status(400).json({ error: 'subscription e payload são obrigatórios' });
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    // 410 = subscription expirada/cancelada pelo usuário
    if (err.statusCode === 410) {
      return res.status(410).json({ error: 'Subscription expirada' });
    }
    console.error('Push error:', err);
    return res.status(500).json({ error: 'Falha ao enviar notificação' });
  }
}
