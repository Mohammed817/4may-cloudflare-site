نسخة جاهزة مبدئيًا للنشر على Cloudflare Pages

1) افتح https://dash.cloudflare.com/ وسجّل الدخول.
2) اذهب إلى Workers & Pages ثم Create application ثم Pages ثم Upload assets (Direct Upload).
3) ارفع ملفات هذا المجلد بعد فك الضغط، مع الحفاظ على مجلد functions/api/news.js.
4) اسمح لـ Cloudflare ببناء المشروع كـ Pages. لا تختَر إعداد Node.js أو Build command؛ هذا موقع ثابت مع Pages Function.
5) بعد النشر افتح رابط الموقع ثم أضف /api/news إلى الرابط لاختبار عناوين الأخبار.

ملاحظة: وظيفة الأخبار تعتمد على أن مصدر 4may.net/sec/RSS.aspx يسمح بالوصول من Cloudflare وأنه يحتوي روابط المقالات. إذا ظهر خطأ أو count=0 سنحتاج تعديل مصدر RSS. احتفظ بموقع Render كما هو إلى أن نتأكد من عمل هذه النسخة.
