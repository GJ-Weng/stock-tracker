const sleep = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  // Limit to 5 symbols, skip options
  const syms = sym.split(',')
    .map(s => s.trim())
    .filter(s => s && !s.includes(' ') && !s.includes('/'))
    .slice(0, 5);

  const results = {};

  // Query one at a time with delay to avoid 429
  for (const s of syms) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://finance.yahoo.com/',
        }
      });

      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const meta = d.chart?.result?.[0]?.meta;
      if (!meta) throw new Error('no meta');

      const now = Date.now() / 1000;
      let nextDate = null;

      if (meta.earningsTimestampStart && meta.earningsTimestampStart > now) {
        nextDate = new Date(meta.earningsTimestampStart * 1000).toISOString().slice(0, 10);
      } else if (meta.earningsTimestampEnd && meta.earningsTimestampEnd > now) {
        nextDate = new Date(meta.earningsTimestampEnd * 1000).toISOString().slice(0, 10);
      }

      results[s] = { nextEarnings: nextDate };
    } catch (e) {
      results[s] = { error: e.message };
    }
    // 300ms delay between requests
    await sleep(300);
  }

  res.json(results);
}
