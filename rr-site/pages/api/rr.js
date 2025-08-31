
import rr from '../../data/rr.json'

export default function handler(req, res) {
  const symbol = String(req.query.symbol || '').toUpperCase()
  const row = rr[symbol]
  if (!row) return res.status(404).json({ error: 'not found' })
  res.status(200).json(row)
}
