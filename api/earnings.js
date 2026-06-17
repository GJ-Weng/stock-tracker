export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { sym } = req.query;
  if (!sym) return res.status(400).json({ error: 'sym required' });

  const syms = sym.split(',').map(s => s.trim()).filter(Boolean);
  const results = {};

  await Promise.all(syms.map(async s => {
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(s)}?modules=calendarEvents,earnings`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        }
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const result = d.quoteSummary?.result?.[0];
      const cal = result?.calendarEvents;
      const earn = result?.earnings;

      // Next earnings date
      const dates = cal?.earnings?.earningsDate;
      let nextDate = null;
      if (dates && dates.length > 0) {
        const ts = dates[0]?.raw;
        if (ts) nextDate = new Date(ts * 1000).toISOString().slice(0, 10);
      }

      // EPS estimate
      const epsEst = earn?.earningsChart?.currentQuarterEstimate?.fmt || null;
      const epsActual = earn?.earningsChart?.quarterly?.slice(-1)[0]?.actual?.fmt || null;

      results[s] = {
        nextEarnings: nextDate,
        epsEstimate: epsEst,
        lastEps: epsActual,
      };
    } catch (e) {
      results[s] = { error: e.message };
    }
  }));

  res.json(results);
}
