# mTracker — سیستم استمرار (SD Method)

اپ مدیریت زمان بر پایهٔ قانون پایداری: **انحراف معیار < میانگین ÷ ۲**

- بدون سرور، بدون دیتابیس، بدون اکانت — دادهٔ هر کاربر فقط در `localStorage` مرورگر خودش ذخیره می‌شود و هیچ‌جا ارسال نمی‌شود.
- مهندسی‌شده با Vite + TypeScript، آفلاین-اول، فارسی/شمسی (ذخیرهٔ تاریخ: میلادی ISO).
- خروجی CSV و بکاپ JSON کامل — داده متعلق به کاربر است.

## اجرا (توسعه)

```bash
npm install
npm run dev      # سرور توسعه روی localhost
npm test         # تست‌های Vitest
npm run build    # خروجی نهایی در dist/
```

## ساختار

```
index.html          ← ورودی Vite
src/                ← ماژول‌های TypeScript (تحلیل، ذخیره‌سازی، UI)
tests/              ← تست‌های Vitest
public/icons/       ← آیکون‌ها (کپی خودکار به dist)
dist/               ← خروجی build — چیزی که منتشر می‌شود
```
## انتشار (Cloudflare Workers — رایگان)
 
 هر push به `main` به‌صورت خودکار منتشر می‌شود:
 
 1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Workers** → **Connect to Git**
 2. گیت‌هاب را authorize کنید و ریپوی `mTracker` را انتخاب کنید
3. Build command: `npm run build` — Deploy command: `npx wrangler deploy`
 4. **Save and Deploy** → آدرس `https://mtracker.<subdomain>.workers.dev` زنده است
 
انتشار دستی: `npm run build && npx wrangler deploy` (نیازمند `wrangler login`).

## مستندات

- [`ROADMAP.md`](ROADMAP.md) — نقشهٔ راه کلی (فاز ۱ تا ۶)
- [`MIGRATION.md`](MIGRATION.md) — نقشهٔ مهاجرت به سرویس آنلاین

## برندینگ

آیکون‌ها در `public/icons/` (سایزهای PWA و favicon)، فایل‌های مادر در `brand/`.
