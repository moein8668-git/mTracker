/* view: داده‌ها */

import type { Repo } from '../../storage';
import { faNum } from '../../settings';

export function viewData(repoOrCount: Repo | number): string {
  const count = typeof repoOrCount === 'number' ? repoOrCount : (repoOrCount?.entries?.length ?? 0);
  const safeCount = faNum(Number.isFinite(count) ? count : 0);

  return `
    <style>
      .view-wrapper {
        width: 100%;
        max-width: 1260px;
        margin: 0 auto;
        direction: rtl;
        font-family: inherit;
        color: #d1d5db;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        box-sizing: border-box;
      }

      /* نوار هدر */
      .banner-header {
        background-color: #111a1e;
        border: 1px solid #1a262c;
        border-radius: 4px;
        height: 54px;
        padding: 0 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-sizing: border-box;
      }
      .banner-right {
        display: flex;
        align-items: center;
        gap: 0.85rem;
      }
      .banner-title {
        font-size: 1.15rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
      }
      .banner-meta {
        font-size: 0.8rem;
        color: #64748b;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
      }
      .banner-meta strong {
        color: #cbd5e1;
        font-weight: 600;
      }

      .btn-teal {
        background-color: #3bb29f;
        color: #0b1517;
        font-size: 0.82rem;
        font-weight: 700;
        border: none;
        border-radius: 3px;
        height: 32px;
        padding: 0 1rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.15s ease;
      }
      .btn-teal:hover {
        opacity: 0.9;
      }

      /* گرید ۳ تایی */
      .grid-three-col {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.25rem;
        width: 100%;
      }

      @media (max-width: 992px) {
        .grid-three-col {
          grid-template-columns: 1fr;
        }
      }

      .dash-card {
        background-color: #10191c;
        border: 1px solid #19252a;
        border-top: 2px solid #3bb29f;
        border-radius: 4px;
        padding: 1.15rem 1.15rem 1rem 1.15rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-sizing: border-box;
      }
      .dash-card.color-orange {
        border-top-color: #e06c3a;
      }
      .dash-card.color-danger {
        border-top-color: #e5484d;
      }

      /* ردیف بالای کارت: چیدمان دقیق RTL */
      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.35rem;
      }
      .card-title-wrap {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }
      .card-dot {
        width: 7px;
        height: 7px;
        background-color: #3bb29f;
        border-radius: 1px;
      }
      .color-orange .card-dot {
        background-color: #e06c3a;
      }
      .color-danger .card-dot {
        background-color: #e5484d;
      }
      .card-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }

      .card-badge {
        font-size: 0.72rem;
        padding: 0.1rem 0.55rem;
        border-radius: 3px;
        background-color: rgba(59, 178, 159, 0.08);
        border: 1px solid rgba(59, 178, 159, 0.22);
        color: #3bb29f;
      }
      .color-orange .card-badge {
        background-color: rgba(224, 108, 58, 0.08);
        border-color: rgba(224, 108, 58, 0.25);
        color: #e06c3a;
      }
      .color-danger .card-badge {
        background-color: rgba(229, 72, 77, 0.08);
        border-color: rgba(229, 72, 77, 0.25);
        color: #e5484d;
      }

      .card-sub-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.76rem;
        color: #64748b;
        margin-bottom: 0.85rem;
      }

      .card-info-box {
        background-color: #0b1114;
        border: 1px solid #141f24;
        border-radius: 3px;
        padding: 0.85rem 0.95rem;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        margin-bottom: 0.85rem;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.78rem;
        color: #7b8d96;
      }
      .info-row b {
        color: #cbd5e1;
        font-weight: 600;
      }
      .info-row.highlight b {
        color: #3bb29f;
      }
      .color-orange .info-row.highlight b {
        color: #e06c3a;
      }
      .color-danger .info-row.highlight b {
        color: #e5484d;
      }

      .card-caption-note {
        font-size: 0.74rem;
        color: #64748b;
        line-height: 1.6;
        margin: 0 0 1rem 0;
      }

      .card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 0.85rem;
        border-top: 1px solid #141e23;
      }
      .footer-actions-left {
        display: flex;
        gap: 0.4rem;
      }
      .btn-dark {
        background-color: #131d22;
        border: 1px solid #1f2f37;
        color: #94a3b8;
        font-size: 0.78rem;
        border-radius: 3px;
        height: 32px;
        padding: 0 0.85rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .btn-dark:hover {
        background-color: #1a272e;
        color: #ffffff;
      }
      .btn-dark.danger-btn {
        color: #ef4444;
        border-color: rgba(239, 68, 68, 0.25);
      }
      .btn-dark.danger-btn:hover {
        background-color: rgba(239, 68, 68, 0.12);
      }

      /* پنل راهنمای ۴ ستونه پایینی */
      .bottom-guide-panel {
        background-color: #10191c;
        border: 1px solid #19252a;
        border-right: 3px solid #3bb29f;
        border-radius: 4px;
        padding: 1.1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .guide-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        padding-bottom: 0.6rem;
        border-bottom: 1px solid #141e23;
      }
      .guide-title {
        font-size: 0.95rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .formula-chip {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.18rem 0.55rem;
        border-radius: 3px;
        background-color: rgba(59, 178, 159, 0.08);
        border: 1px solid rgba(59, 178, 159, 0.22);
        color: #3bb29f;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        flex-shrink: 0;
        line-height: 1.4;
      }
      @media (max-width: 640px) {
        .guide-panel-head {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .formula-chip {
          align-self: flex-start;
        }
      }
      .guide-items-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.85rem;
      }

      @media (max-width: 900px) {
        .guide-items-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 500px) {
        .guide-items-grid {
          grid-template-columns: 1fr;
        }
      }

      .guide-col-card {
        background-color: #0b1114;
        border: 1px solid #152026;
        border-radius: 3px;
        padding: 0.75rem 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .guide-col-header {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.8rem;
        font-weight: 700;
        color: #e2e8f0;
      }
      .guide-col-num {
        color: #3bb29f;
        font-size: 0.82rem;
        font-weight: 800;
      }
      .guide-col-text {
        font-size: 0.75rem;
        color: #8da2ad;
        line-height: 1.6;
        margin: 0;
      }
    </style>

    <div class="view-wrapper">
      <!-- هدر -->
      <header class="banner-header">
        <div class="banner-right">
          <h2 class="banner-title">داده‌ها</h2>
          <div class="banner-meta">
            <strong>${safeCount}</strong> ثبت
            <span>•</span>
            <span>مدیریت پایگاه داده محلی</span>
          </div>
        </div>
        <button type="button" class="btn-teal" data-action="import-click">+ ورود داده جدید</button>
      </header>

      <!-- کارت‌ها -->
      <div class="grid-three-col">

        <!-- کارت ۱: پشتیبان‌گیری -->
        <section class="dash-card">
          <div>
            <div class="card-top">
              <div class="card-title-wrap">
                <span class="card-dot"></span>
                <h3 class="card-title">پشتیبان‌گیری</h3>
              </div>
              <span class="card-badge">پایدار</span>
            </div>
            <div class="card-sub-row">
              <span>ذخیره‌سازی</span>
              <span>حافظه مرورگر</span>
            </div>

            <div class="card-info-box">
              <div class="info-row highlight">
                <span>وضعیت:</span>
                <b>آماده استخراج</b>
              </div>
              <div class="info-row">
                <span>تعداد رکوردها:</span>
                <b>${safeCount} ثبت</b>
              </div>
              <div class="info-row">
                <span>فرمت‌های خروجی:</span>
                <b>JSON / CSV</b>
              </div>
            </div>

            <p class="card-caption-note">
              پیش از پاک کردن کش یا تعویض مرورگر، حتماً خروجی بگیرید.
            </p>
          </div>

          <div class="card-footer">
            <div class="footer-actions-left">
              <button type="button" class="btn-dark" data-action="export-json">بکاپ JSON</button>
            </div>
            <button type="button" class="btn-teal" data-action="export-csv">+ خروجی CSV</button>
          </div>
        </section>

        <!-- کارت ۲: همگام‌سازی -->
        <section class="dash-card color-orange">
          <div>
            <div class="card-top">
              <div class="card-title-wrap">
                <span class="card-dot"></span>
                <h3 class="card-title">همگام‌سازی</h3>
              </div>
              <span class="card-badge">نوسانی</span>
            </div>
            <div class="card-sub-row">
              <span>روش اتصال</span>
              <span>Pomodorus Sync</span>
            </div>

            <div class="card-info-box">
              <div class="info-row highlight">
                <span>اپلیکیشن مبدا:</span>
                <b>پومودوروس</b>
              </div>
              <div class="info-row">
                <span>تطبیق تسک‌ها:</span>
                <b>خودکار</b>
              </div>
              <div class="info-row">
                <span>فیلدهای معتبر:</span>
                <b>date, task, hours</b>
              </div>
            </div>

            <p class="card-caption-note">
              متن JSON را از لینک داده پومودوروس کپی کرده و اینجا وارد کنید.
            </p>
          </div>

          <div class="card-footer">
            <div class="footer-actions-left">
              <button type="button" class="btn-dark" data-action="import-click">ورود فایل</button>
            </div>
            <button type="button" class="btn-teal" data-action="open-pomodorus">+ ورود از پومودوروس</button>
          </div>
        </section>

        <!-- کارت ۳: پاک‌سازی -->
        <section class="dash-card color-danger">
          <div>
            <div class="card-top">
              <div class="card-title-wrap">
                <span class="card-dot"></span>
                <h3 class="card-title">پاک‌کردن داده‌ها</h3>
              </div>
              <span class="card-badge">حساس</span>
            </div>
            <div class="card-sub-row">
              <span>سطح دسترسی</span>
              <span>غیرقابل بازگشت</span>
            </div>

            <div class="card-info-box">
              <div class="info-row highlight">
                <span>نوع عملیات:</span>
                <b>ریست کامل دیتابیس</b>
              </div>
              <div class="info-row">
                <span>تسک‌ها و ساعت‌ها:</span>
                <b>حذف دائمی</b>
              </div>
              <div class="info-row">
                <span>قابلیت بازیابی:</span>
                <b>فقط با بکاپ JSON</b>
              </div>
            </div>

            <p class="card-caption-note">
              این عملیات تمام اطلاعات ذخیره‌شده را از بین می‌برد.
            </p>
          </div>

          <div class="card-footer" style="justify-content: flex-end;">
            <button type="button" class="btn-dark danger-btn" data-action="reset-all">حذف همه داده‌ها</button>
          </div>
        </section>

      </div>

      <!-- پنل راهنمای ۴ ستونه پایینی -->
      <section class="bottom-guide-panel">
        <div class="guide-panel-head">
          <h4 class="guide-title">
            <span style="color: #3bb29f;">◆</span>
            روش SD و اصول پیوستگی کارکرد
          </h4>
          <span class="formula-chip">انحراف معیار &lt; میانگین ÷&nbsp;۲</span>
        </div>

        <div class="guide-items-grid">
          <div class="guide-col-card">
            <div class="guide-col-header">
              <span class="guide-col-num">۱.</span>
              <span>ارزش پیوستگی</span>
            </div>
            <p class="guide-col-text">۷ ساعت در ۷ روز، از ۷ ساعت در ۱ روز بسیار ارزشمندتر است.</p>
          </div>

          <div class="guide-col-card">
            <div class="guide-col-header">
              <span class="guide-col-num">۲.</span>
              <span>ثبت دقیق</span>
            </div>
            <p class="guide-col-text">روزهای بدون کار صفر حساب می‌شوند؛ هیچ روزی را خالی نگذارید.</p>
          </div>

          <div class="guide-col-card">
            <div class="guide-col-header">
              <span class="guide-col-num">۳.</span>
              <span>کف عملکرد</span>
            </div>
            <p class="guide-col-text">حداقل ۳ ساعت تمرکز روزانه برای پیشبرد کارهای تخصصی پیشنهاد می‌شود.</p>
          </div>

          <div class="guide-col-card">
            <div class="guide-col-header">
              <span class="guide-col-num">۴.</span>
              <span>دید ماهانه</span>
            </div>
            <p class="guide-col-text">به‌جای قضاوت یک روز، معدل ماه را بسنجید تا نوسان‌ها جبران شوند.</p>
          </div>
        </div>
      </section>

    </div>
  `.trim();
}