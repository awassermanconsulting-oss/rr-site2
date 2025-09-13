// pages/api/chart.js
// Proxy remote images, compressing them for delivery.

import sharp from "sharp";

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
    const optimized = await sharp(buf)
      .resize({ width: 800 })
      .webp({ quality: 80 })
      .toBuffer();

    // Force an image content type and inline display
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Content-Disposition", "inline; filename=chart.webp");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

    return res.status(200).send(optimized);
  } catch (e) {
    return res.status(500).send("error");
  }
}
