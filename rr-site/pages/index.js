
import { useState } from 'react'

export default function Home() {
  const [symbol, setSymbol] = useState('AAPL')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const stripeLink = process.env.NEXT_PUBLIC_STRIPE_LINK || '#'

  async function check() {
    setLoading(true)
    try {
      const [p, rr] = await Promise.all([
        fetch('/api/price?symbol=' + encodeURIComponent(symbol)).then(r=>r.json()),
        fetch('/api/rr?symbol=' + encodeURIComponent(symbol)).then(r=>r.json())
      ])
      setResult({ price: p.price, rr })
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container grid">
      <header className="grid">
        <h1>Risk/Reward Tracker</h1>
        <p className="small">Paste a ticker, get today’s price and see it vs. your fixed high/low lines.</p>
        <div><a className="badge" href={stripeLink} target="_blank" rel="noreferrer">Subscribe – $1/month</a></div>
      </header>

      <section className="card grid">
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} placeholder="Ticker e.g. AAPL" />
          <button onClick={check} disabled={loading}>{loading? 'Checking…' : 'Check'}</button>
        </div>
        <div className="small">Quick picks: 
          {['AAPL','MSFT','NVDA','AMZN'].map(t=> (
            <button key={t} onClick={()=>setSymbol(t)} style={{marginLeft:8}} className="badge">{t}</button>
          ))}
        </div>

        {result && (
          <div className="grid">
            <table>
              <tbody>
                <tr><th>Ticker</th><td>{symbol}</td></tr>
                <tr><th>Current Price</th><td>${Number(result.price).toFixed(2)}</td></tr>
                <tr><th>High Line</th><td>${Number(result.rr.hi).toFixed(2)}</td></tr>
                <tr><th>Low Line</th><td>${Number(result.rr.lo).toFixed(2)}</td></tr>
                <tr><th>As Of</th><td>{result.rr.asOf}</td></tr>
                <tr><th>Status</th>
                  <td>{Number(result.price)>Number(result.rr.hi) ? 'Above high' : Number(result.price)<Number(result.rr.lo) ? 'Below low' : 'Inside band'}</td>
                </tr>
              </tbody>
            </table>
            <div className="small">Risk/Reward lines are static from your data source; we’ll automate updates later.</div>
          </div>
        )}
      </section>
    </div>
  )
}
