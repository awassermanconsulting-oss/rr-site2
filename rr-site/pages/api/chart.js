// pages/api/chart.js
// Proxy remote PNGs so the browser will render them inline.

export default async function handler(req, res) {
  try {
    const url = String(req.query.url || "");
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).send("bad url");
    }

    const upstream = await fetch(url, {
      // avoid cached "attachment" responses
      cache: "no-store",
      headers: {
        // some hosts require a user-agent/referrer to serve the file
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Referer: "https://"+req.headers.host,
      },
    });

    if (!upstream.ok) {
      return res.status(502).send("upstream error");
    }

    const buf = Buffer.from(await upstream.arrayBuffer());

    // Force an image content type and inline display
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", "inline; filename=chart.png");
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes

    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).send("error");
  }
}
