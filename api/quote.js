export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  const syms = sym.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  await Promise.all(syms.map(async s => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=5d`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const result = d.chart?.result?.[0];
      const meta = result?.meta;
      if (!meta?.regularMarketPrice) throw new Error('no price');

      const price = meta.regularMarketPrice;

      // Try regularMarketChange first
      let chg = meta.regularMarketChange;

      // If not available, compute from closes array (today close - yesterday close)
      if (chg === null || chg === undefined || chg === 0) {
        const closes = result?.indicators?.quote?.[0]?.close;
        if (closes && closes.length >= 2) {
          // Get last two valid closes
          const valid = closes.filter(c => c !== null && c !== undefined);
          if (valid.length >= 2) {
            chg = valid[valid.length - 1] - valid[valid.length - 2];
          }
        }
        // Final fallback: use previousClose from meta
        if ((chg === null || chg === undefined) && meta.previousClose) {
          chg = price - meta.previousClose;
        }
        if ((chg === null || chg === undefined) && meta.chartPreviousClose) {
          chg = price - meta.chartPreviousClose;
        }
      }

      results[s] = {
        price: Math.round(price * 100) / 100,
        chg: Math.round((chg || 0) * 100) / 100,
      };
    } catch (e) {
      results[s] = { error: e.message };
    }
  }));

  res.json(results);
}
