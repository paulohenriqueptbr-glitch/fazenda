// api/push-subscription.js
// Salva e remove subscriptions push via Supabase

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, key);
}

export default async function handler(req, res) {
  // Headers básicos
  res.setHeader('Content-Type', 'application/json');

  const supabase = getSupabase();

  // Recupera token de sessão do header Authorization
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) return res.status(401).json({ error: 'Não autenticado' });

  // Verifica usuário
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return res.status(401).json({ error: 'Sessão inválida' });

  if (req.method === 'POST') {
    // Salvar subscription
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'subscription é obrigatória' });

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription: subscription,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });

  } else if (req.method === 'DELETE') {
    // Remover subscription (usuário desativou notificações)
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint é obrigatório' });

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });

  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
