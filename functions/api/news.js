const FEED_URL = 'https://www.4may.net/sec/RSS.aspx';
const MAX_NEWS = 6;
function decodeEntities(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
function clean(s) { return decodeEntities(String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function safeUrl(raw) { try { const u = new URL(decodeEntities(raw), 'https://www.4may.net/'); return /^https?:$/.test(u.protocol) && /(^|\.)4may\.net$/i.test(u.hostname) ? u.href : null; } catch { return null; } }
function isArticleUrl(rawUrl) { try { return /^\/Mnews\/\d+\/?$/i.test(new URL(rawUrl).pathname); } catch { return false; } }
function titleKey(title) { return clean(title).toLocaleLowerCase('ar').replace(/[ـ\u064B-\u065F\u0670]/g, '').replace(/[\s\p{P}\p{S}]+/gu, ' ').trim(); }
function uniqueArticles(items) { const seenUrls = new Set(), seenTitles = new Set(), result = []; for (const item of items) { const title = clean(item.title), url = safeUrl(item.url); if (!title || !url || !isArticleUrl(url) || title.length < 12) continue; if (/^(اهم الاخبار|أهم الأخبار|صحيفة 4 مايو الالكترونية|شئون الانتقالي|شؤون الانتقالي|اخبار وتقارير|أخبار وتقارير|عرب وعالم|قسم الفيديو|فيديو|الرئيسية|اتصل بنا|هيئة التحرير|المزيد)$/i.test(title)) continue; const key = titleKey(title); if (!key || seenUrls.has(url) || seenTitles.has(key)) continue; seenUrls.add(url); seenTitles.add(key); result.push({title,url}); if (result.length >= MAX_NEWS) break; } return result; }
function parseFeed(body) { const found = [], blocks = body.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || []; for (const block of blocks) { const tm = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i); const lm = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i) || block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i) || block.match(/<guid\b[^>]*>([\s\S]*?)<\/guid>/i); const title = clean(tm && tm[1]), url = safeUrl(lm && lm[1]); if (title && url) found.push({title,url}); } if (!found.length) { const re = /<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi; let m; while ((m = re.exec(body))) { const url = safeUrl(m[3]), title = clean(m[5]); if (url && title) found.push({title,url}); } } return uniqueArticles(found); }
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname !== '/api/news') return new Response('Not found', {status:404});
  const cache = caches.default;
  const key = new Request(url.origin + '/api/news?cache=5min');
  if (url.searchParams.get('refresh') !== '1') { const cached = await cache.match(key); if (cached) return cached; }
  try {
    const response = await fetch(FEED_URL, {headers:{'user-agent':'4MayNewsMirror/1.1','accept':'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8'}, cf:{cacheTtl:300,cacheEverything:true}});
    if (!response.ok) throw new Error('Publisher returned HTTP ' + response.status);
    const items = parseFeed(await response.text());
    if (!items.length) throw new Error('No unique article links found in publisher feed');
    const out = new Response(JSON.stringify({source:FEED_URL,updatedAt:new Date().toISOString(),count:items.length,items,error:null}), {headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300','access-control-allow-origin':'*'}});
    await cache.put(key,out.clone()); return out;
  } catch (e) {
    return new Response(JSON.stringify({source:FEED_URL,updatedAt:null,count:0,items:[],error:e.message || 'Fetch failed'}), {status:502,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  }
}

