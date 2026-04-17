export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  const syms = sym.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  await Promise.all(syms.map(async s => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const meta = d.chart?.result?.[0]?.meta;
      if (!meta?.regularMarketPrice) throw new Error('no price');
      results[s] = {
        price: meta.regularMarketPrice,
        chg: meta.regularMarketPrice - meta.previousClose
      };
    } catch (e) {
      results[s] = { error: e.message };
    }
  }));

  res.json(results);
}
