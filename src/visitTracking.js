const SUPABASE_URL = 'https://sgzattxgduoowsmijifa.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gYYVuo4ejQqkiWUWxTpp1Q_3At7lpJD';

export async function recordVisit() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/jerico-visit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY
    },
    body: '{}',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Visit tracking failed: ${response.status}`);
  }

  const result = await response.json();
  const total = Number(result.total);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error('Invalid visit count received');
  }

  return total;
}
