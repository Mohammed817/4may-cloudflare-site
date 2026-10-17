
// Vercel - api/news.js
// يسحب الأخبار التي تظهر أسفل هذا المنشور بالتحديد: https://www.4may.net/Mnews/138173

const TARGET_URL = "https://www.4may.net/Mnews/138173";
const MAX_NEWS = 20;

function clean(s=""){ return s.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim(); }
function decodeEntities(s=""){ return s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">"); }

function extractBottomNews(html){
  const items=[]; 
  const seen=new Set();
  
  // نحاول نحدد منطقة أسفل المقال: بعد كلمة "اقرأ أيضا" أو "أخبار ذات صلة" أو "المزيد"
  // لو ما لقيناها، نأخذ كل الروابط في الصفحة ما عدا المقال نفسه
  const lowerHtml = html.toLowerCase();
  let startIdx = 0;
  const markers = ["اقرأ أيضا", "اخبار ذات صلة", "أخبار ذات صلة", "اخبار متعلقة", "قد يعجبك", "المزيد من"];
  for(const m of markers){
    const idx = lowerHtml.indexOf(m.toLowerCase());
    if(idx !== -1){ startIdx = idx; break; }
  }
  const relevantHtml = startIdx ? html.substring(startIdx) : html;

  const regex = /<a[^>]+href=["']([^"']*\/Mnews\/\d+[^"']*)["'][^>]*>([^<]{8,200})<\/a>/gi;
  let match;
  while((match = regex.exec(relevantHtml))){
    let url = match[1].trim();
    let title = clean(decodeEntities(match[2])).trim();
    
    // استبعاد نفس المقال الأصلي 138173
    if(url.includes("138173")) continue;
    if(!url.startsWith("http")) url = "https://www.4may.net" + url;
    if(title.length < 10 || title.length > 200) continue;
    if(/^(الرئيسية|اتصل بنا|المزيد|اقرأ المزيد|صحيفة 4 مايو|اخبار وتقارير)$/i.test(title)) continue;
    if(seen.has(url)) continue;
    
    seen.add(url);
    items.push({ title, url });
    if(items.length >= MAX_NEWS) break;
  }
  return items;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=120");

  try {
    const r = await fetch(TARGET_URL, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "ar-YE,ar;q=0.9",
        "referer": "https://www.4may.net/"
      }
    });
    if(!r.ok) throw new Error("HTTP "+r.status);

    const html = await r.text();
    const items = extractBottomNews(html);

    if(!items.length) throw new Error("لم يتم العثور على أخبار أسفل المنشور - قد يكون التصميم تغير");

    return res.status(200).json({
      source: TARGET_URL,
      updatedAt: new Date().toISOString(),
      count: items.length,
      items,
      error: null
    });

  } catch (e) {
    return res.status(502).json({
      source: TARGET_URL,
      updatedAt: null,
      count: 0,
      items: [],
      error: e.message
    });
  }
};
