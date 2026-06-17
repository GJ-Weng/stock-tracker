export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  const syms = sym.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  await Promise.all(syms.map(async s => {
    try {
      // Use v8 chart API (same as quote.js) - more reliable than v10
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d&modules=calendarEvents`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const meta = d.chart?.result?.[0]?.meta;

      // v8 has earningsTimestamp in meta
      let nextDate = null;
      if (meta?.earningsTimestampStart) {
        nextDate = new Date(meta.earningsTimestampStart * 1000).toISOString().slice(0, 10);
      } else if (meta?.earningsTimestamp) {
        nextDate = new Date(meta.earningsTimestamp * 1000).toISOString().slice(0, 10);
      }

      results[s] = {
        nextEarnings: nextDate,
        epsEstimate: null,
        lastEps: null,
      };
    } catch (e) {
      results[s] = { error: e.message };
    }
  }));

  res.json(results);
}
