// pages/api/chart.js
// Proxy remote PNGs so the browser will display them instead of downloading.

export default async function handler(req, res) {
  try {
    const url = String(req.query.url || "");
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).send("bad url");
    }

    // Fetch the remote image
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      return res.status(502).send("upstream error");
    }

    // We stream it back with display-friendly headers
    const contentType = r.headers.get("content-type") || "image/png";
    const arrayBuffer = await r.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    // inline so it renders in <img>, not forced download
    res.setHeader("Content-Disposition", "inline; filename=chart.png");
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes

    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (e) {
    return res.status(500).send("error");
  }
}
