# mTracker — سیستم استمرار (SD Method)

اپ مدیریت زمان بر پایهٔ قانون پایداری: **انحراف معیار < میانگین ÷ ۲**

- بدون سرور، بدون دیتابیس، بدون اکانت — دادهٔ هر کاربر فقط در `localStorage` مرورگر خودش ذخیره می‌شود و هیچ‌جا ارسال نمی‌شود.
- تک‌فایل، آفلاین-اول، فارسی/شمسی (ذخیرهٔ تاریخ: میلادی ISO).
- خروجی CSV و بکاپ JSON کامل — داده متعلق به کاربر است.

## اجرا

هیچ build‌ای لازم نیست: `public/index.html` را در مرورگر باز کنید.

## انتشار (Cloudflare Workers — رایگان)

هر push به `main` به‌صورت خودکار منتشر می‌شود:

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
2. گیت‌هاب را authorize کنید و ریپوی `mTracker` را انتخاب کنید
3. Build command را خالی بگذارید؛ Deploy command: `npx wrangler deploy`
4. **Save and Deploy** → آدرس `https://mtracker.<subdomain>.workers.dev` زنده است

انتشار دستی هم ممکن است: `npx wrangler deploy` (نیازمند `wrangler login`).

## مستندات

- [`ROADMAP.md`](ROADMAP.md) — نقشهٔ راه کلی (فاز ۱ تا ۶)
- [`MIGRATION.md`](MIGRATION.md) — نقشهٔ مهاجرت به سرویس آنلاین

## برندینگ

آیکون‌ها در `public/icons/` (سایزهای PWA و favicon)، فایل‌های مادر در `brand/`.
