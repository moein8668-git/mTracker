/* view: داده‌ها */

import { faNum } from '../../settings';

export function viewData(entriesCount: number): string {
  return '<section class="hero"><div><div class="hero-date">داده‌ها</div>' +
    '<div class="hero-sub">خروجی، ورودی و پشتیبان‌گیری</div></div></section>' +
    '<div class="grid2">' +
    '<section class="card"><h4>خروجی گرفتن</h4>' +
    '<p class="desc">داده‌های تو («' + faNum(entriesCount) + '» ثبت) فقط در حافظهٔ همین مرورگر ذخیره می‌شود و به هیچ سروری فرستاده نمی‌شود. قبل از پاک کردن حافظهٔ مرورگر یا تغییر دستگاه، حتماً خروجی بگیر.</p>' +
    '<div class="btnrow">' +
    '<button class="btn" data-action="export-csv">خروجی CSV (برای Excel)</button>' +
    '<button class="btn" data-action="export-json">بکاپ کامل JSON</button>' +
    '</div></section>' +
    '<section class="card"><h4>ورود داده</h4>' +
    '<p class="desc">CSV با ستون‌های date, task, hours, note (تاریخ میلادی به شکل 2026-08-31 یا 2026/08/31). تسکی که وجود نداشته باشد خودکار ساخته می‌شود. فایل JSON بکاپ کامل را بازگردانی می‌کند.</p>' +
    '<div class="btnrow">' +
    '<button class="btn" data-action="import-click">ورود CSV / JSON</button>' +
    '</div></section>' +
    '<section class="card guide"><h4>روش SD در یک نگاه</h4>' +
    '<div class="formula">انحراف معیار &lt; میانگین ÷ ۲</div>' +
    '<ol>' +
    '<li>۷ ساعت در ۷ روز، از ۷ ساعت در ۱ روز ارزشمندتر است.</li>' +
    '<li>هیچ تسکی را بدون ثبت انجام نده؛ روزهای بدون کار صفر حساب می‌شوند.</li>' +
    '<li>هدف پیشنهادی برای کار تخصصی: حداقل ۳ ساعت در روز.</li>' +
    '<li>به‌جای قضاوت روزانه، کل ماه را ببین؛ روز بد در میانگین ماهانه جبران می‌شود.</li>' +
    '<li>اگر نوسانت زیاد بود، برنامه را سبک‌تر اما منظم‌تر کن.</li>' +
    '</ol></section>' +
    '<section class="card danger-zone"><h4>پاک‌کردن همه داده‌ها</h4>' +
    '<p class="desc">همه تسک‌ها و ثبت‌ها از این مرورگر حذف می‌شوند. این کار بازگشت‌پذیر نیست.</p>' +
    '<button class="btn danger" data-action="reset-all">پاک‌کردن همه داده‌ها</button>' +
    '</section>' +
    '</div>';
}
