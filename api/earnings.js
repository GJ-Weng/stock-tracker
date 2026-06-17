export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  const syms = sym.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  await Promise.all(syms.map(async s => {
    try {
      // Try v8 chart API first (same as quote.js)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
          'Origin': 'https://finance.yahoo.com',
        }
      });

      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const meta = d.chart?.result?.[0]?.meta;

      if (!meta) throw new Error('no meta in response');

      // earningsTimestampStart = start of upcoming earnings window
      // earningsTimestamp = most recent earnings
      let nextDate = null;
      const now = Date.now() / 1000;

      if (meta.earningsTimestampStart && meta.earningsTimestampStart > now) {
        nextDate = new Date(meta.earningsTimestampStart * 1000).toISOString().slice(0, 10);
      } else if (meta.earningsTimestampEnd && meta.earningsTimestampEnd > now) {
        nextDate = new Date(meta.earningsTimestampEnd * 1000).toISOString().slice(0, 10);
      } else if (meta.earningsTimestamp && meta.earningsTimestamp > now) {
        nextDate = new Date(meta.earningsTimestamp * 1000).toISOString().slice(0, 10);
      }

      results[s] = {
        nextEarnings: nextDate,
        epsEstimate: null,
        // Debug info
        _ts: meta.earningsTimestamp,
        _tsStart: meta.earningsTimestampStart,
        _tsEnd: meta.earningsTimestampEnd,
        _now: Math.floor(now),
      };
    } catch (e) {
      results[s] = { error: e.message };
    }
  }));

  res.json(results);
}
