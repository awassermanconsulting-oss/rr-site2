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

    let body = buf;
    let contentType = upstream.headers.get("content-type") || "image/png";

    try {
      body = await sharp(buf)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      contentType = "image/webp";
    } catch (err) {
      // fall back to the original bytes if sharp cannot process the image
      body = buf;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline; filename=chart");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

    return res.status(200).send(body);
  } catch (e) {
    return res.status(500).send("error");
  }
}
