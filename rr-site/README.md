
# Risk/Reward Tracker (No-Login MVP)

This is a super-simple website that:
- lets you type a stock ticker
- fetches the **current price** using Alpha Vantage (free)
- shows your **Risk/Reward high & low** lines from `data/rr.json`
- has a **Subscribe** button you can point at your Stripe **Payment Link** for $1/month

No monthly fees to run: host on **Vercel (free)** + Stripe fees only when someone pays.

---

## Setup in 10 minutes (no coding)

### 0) You need accounts
- **GitHub** (free): https://github.com/join
- **Vercel** (free): https://vercel.com/signup

### 1) Put this code on GitHub (no Git needed)
1. Go to https://github.com/new → **Repository name:** `rr-site` → **Create repository**.
2. On the repo page, click **“Add file” → “Upload files”**.
3. Drag & drop the folder contents you downloaded (all files) into GitHub and **Commit changes**.

### 2) Connect Vercel to that repo
1. Go to https://vercel.com/new → click **GitHub** and authorize (choose your `rr-site` repo).
2. On the **“Environment Variables”** step, add:
   - **Name:** `ALPHA_VANTAGE_KEY` → **Value:** YOUR_KEY (you already created this)
   - **Name:** `NEXT_PUBLIC_STRIPE_LINK` → **Value:** your Stripe **Payment Link URL**
     - (In Stripe: Products → your $1 product → **Payment Links** → create a link → copy URL)
3. Click **Deploy**. In ~1–2 minutes you’ll get a live URL like `https://rr-site-yourname.vercel.app`.

> **What is `.env`?** It’s a file for secret settings like API keys. On Vercel, you **don’t** need a `.env` file — you add keys as **Environment Variables** in the dashboard (step 2).

### 3) Try it
- Open your site → type `AAPL` → **Check**.
- Click **Subscribe – $1/month** → it should open your Stripe Payment Link.

### 4) Update your Risk/Reward lines
- On GitHub → open `data/rr.json` → click the pencil icon to edit.
- Add or change tickers like:
```json
{
  "AAPL": {"hi": 260, "lo": 185, "asOf": "2025-08-01"},
  "TSLA": {"hi": 300, "lo": 200, "asOf": "2025-08-01"}
}
```
- Click **Commit changes**. Vercel redeploys automatically.

---

## FAQ

**What is SMTP?** Ignore for now. SMTP is the thing that sends emails for login codes. We’re not using logins in this MVP.

**Can we add a login later?** Yes. We’ll add email sign-in and a real paywall once you’re happy with the core feature.

**Can we automate the High/Low lines?** Yes. Next step is a small scheduled job that reads them from your source site and updates `rr.json` automatically.

**Where do I find the Payment Link in Stripe?** In the Stripe Dashboard, open your $1/month product → click **Payment Links** → **Create payment link** → copy the URL and paste it into the Vercel variable `NEXT_PUBLIC_STRIPE_LINK`.
