
export default async function handler(req, res) {
  const symbol = String(req.query.symbol || '').toUpperCase()
  if (!symbol) return res.status(400).json({ error: 'symbol required' })
  const key = process.env.ALPHA_VANTAGE_KEY
  if (!key) return res.status(500).json({ error: 'ALPHA_VANTAGE_KEY missing' })
  try {
    const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`)
    const data = await r.json()
    const price = Number(data?.["Global Quote"]?.["05. price"])
    if (!isFinite(price)) return res.status(404).json({ error: 'no price' })
    res.status(200).json({ price })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
