
const FEED_URL = "https://www.4may.net/sec/RSS.aspx";
const MAX_NEWS = 6;

function decodeEntities(s = "") {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([\da-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function clean(s = "") {
  return decodeEntities(
    String(s)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function safeUrl(raw = "") {
  try {
    const u = new URL(decodeEntities(raw), "https://www.4may.net/");
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!/(^|\.)4may\.net$/i.test(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

function titleKey(title) {
  return clean(title)
    .toLocaleLowerCase("ar")
    .replace(/[ـ\u064B-\u065F\u0670]/g, "")
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
}

function parseFeed(body) {
  const found = [];
  const blocks =
    body.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];

  for (const block of blocks) {
    const tm = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const lm =
      block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i) ||
      block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i) ||
      block.match(/<guid\b[^>]*>([\s\S]*?)<\/guid>/i);

    const title = clean(tm?.[1]);
    const url = safeUrl(lm?.[1]);

    if (title && url && /^\/Mnews\/\d+\/?$/i.test(new URL(url).pathname)) {
      found.push({ title, url });
    }
  }

  const seenUrls = new Set();
  const seenTitles = new Set();
  const items = [];

  for (const item of found) {
    const key = titleKey(item.title);
    if (item.title.length < 12 || !key) continue;
    if (seenUrls.has(item.url) || seenTitles.has(key)) continue;

    seenUrls.add(item.url);
    seenTitles.add(key);
    items.push(item);

    if (items.length >= MAX_NEWS) break;
  }

  return items;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(FEED_URL, {
      headers: {
        "user-agent": "4MayNewsMirror/1.1",
        accept: "application/rss+xml, application/xml, text/xml, */*"
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error("Publisher returned HTTP " + response.status);
    }

    const items = parseFeed(await response.text());

    if (!items.length) {
      throw new Error("No valid article links found in publisher feed");
    }

    return res.status(200).json({
      source: FEED_URL,
      updatedAt: new Date().toISOString(),
      count: items.length,
      items,
      error: null
    });
  } catch (error) {
    return res.status(502).json({
      source: FEED_URL,
      updatedAt: null,
      count: 0,
      items: [],
      error: error.message || "Fetch failed"
    });
  }
};
