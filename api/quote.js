export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  const syms = sym.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  await Promise.all(syms.map(async s => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=2d`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const meta = d.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) throw new Error('no price');

      // Use regularMarketChange directly (most reliable)
      // Fallback: compute from previousClose
      const price = meta.regularMarketPrice;
      const chg = meta.regularMarketChange
        ?? (meta.previousClose ? price - meta.previousClose : 0);

      results[s] = {
        price: price,
        chg: Math.round(chg * 100) / 100,
        pct: meta.regularMarketChangePercent
          ?? (meta.previousClose ? (chg / meta.previousClose * 100) : 0)
      };
    } catch (e) {
      results[s] = { error: e.message };
    }
  }));

  res.json(results);
}
