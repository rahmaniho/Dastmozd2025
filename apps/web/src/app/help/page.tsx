'use client';

import { toPersianDigits } from '@dastmozd/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
} from '@dastmozd/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface HelpTopic {
  id: string;
  title: string;
  steps: string[];
  note?: string;
  tags: string[];
}

const GETTING_STARTED: HelpTopic[] = [
  {
    id: 'company',
    title: 'گام ۱ — پرونده شرکت و کارگاه',
    steps: [
      'به «تنظیمات ← شرکت و کارگاه» بروید و شناسه اقتصادی، کد کارگاه، نشانی و نام مدیرعامل را کامل کنید؛ این اطلاعات روی فیش حقوقی و دیسکت بیمه چاپ می‌شود.',
      'ساعت کاری هفتگی، ساعت شروع شیفت و مهلت استراحت میانروز را تنظیم کنید تا کسر تأخیر درست محاسبه شود.',
      'اگر چند شرکت دارید، با «افزودن شرکت» پرونده دوم را بسازید و از نوار بالا بین شرکت‌ها جابه‌جا شوید.',
    ],
    tags: ['شرکت', 'کارگاه', 'تنظیمات'],
  },
  {
    id: 'employees',
    title: 'گام ۲ — ثبت کارکنان',
    steps: [
      'در صفحه «کارکنان» روی «کارمند جدید» بزنید؛ نام، کد ملی، شماره بیمه و تاریخ استخدام الزامی است.',
      'برای ورود گروهی، فایل اکسل با ستون‌های قالب نمونه را بارگذاری کنید؛ گزارش اعتبارسنجی پیش از ثبت نمایش داده می‌شود.',
      'شماره پرسنلی و کد ملی باید یکتا باشند؛ سامانه سطرهای تکراری را ثبت نمی‌کند و علت را گزارش می‌دهد.',
    ],
    tags: ['کارمند', 'اکسل', 'کد ملی'],
  },
  {
    id: 'attendance',
    title: 'گام ۳ — ثبت کارکرد ماهانه',
    steps: [
      'در «حضور و غیاب» روز مورد نظر را انتخاب و نوع کارکرد، ساعت ورود و خروج را ثبت کنید.',
      'برای ماه‌های گذشته از «ورود کارکرد از فایل» با آداپتور پرسپولیس، سپیدار یا راهکاران استفاده کنید.',
      'ساعت‌های اضافه‌کار، شب‌کاری و تعطیل رسمی به‌صورت خودکار در محاسبه ضریب می‌گیرند.',
    ],
    note: 'کارکرد ناقص ماه در گام «کارکرد» ویزارد حقوق با هشدار زرد نمایش داده می‌شود.',
    tags: ['کارکرد', 'اضافه‌کار', 'شب‌کاری'],
  },
  {
    id: 'payroll',
    title: 'گام ۴ — اجرای دوره حقوقی',
    steps: [
      'در «محاسبه حقوق» ماه و سال را از نوار بالا انتخاب کنید و ویزارد چهارگامی را کامل کنید: اطلاعات پایه، کارکرد، مزایا، کسورات.',
      'پیش از اجرای نهایی، پیش‌نمایش هر کارمند را ببینید؛ رهگیری محاسبه هر سطر را با شرح فرمول نشان می‌دهد.',
      'با «اجرای دوره» نسخه جدید ساخته می‌شود؛ اجرای دوباره همان ماه، نسخه تازه می‌سازد و نسخه قبلی دست‌نخورده می‌ماند.',
      'پس از تأیید، دوره را «قفل» کنید تا کارکرد و اعداد آن ماه قابل تغییر نباشد.',
    ],
    tags: ['حقوق', 'ویزارد', 'قفل دوره'],
  },
  {
    id: 'reports',
    title: 'گام ۵ — فیش، بیمه و مالیات',
    steps: [
      'در «گزارش‌ها ← فیش حقوقی» برای هر کارمند فیش فارسی با کد QR بسازید و آن را چاپ یا PDF کنید.',
      'برای سازمان تأمین اجتماعی، «دیسکت بیمه» را با نام DSK بگیرید و پیش از ارسال با نسخه روز سامانه تطبیق دهید.',
      'برای سازمان امور مالیاتی، فایل اکسل لیست حقوق را از همان صفحه بارگیری کنید.',
    ],
    tags: ['فیش', 'بیمه', 'مالیات', 'گزارش'],
  },
  {
    id: 'backup',
    title: 'گام ۶ — پشتیبان‌گیری و بازگردانی',
    steps: [
      'در «تنظیمات ← پشتیبان‌گیری» یک گذرواژه قوی بگذارید تا فایل با AES-GCM رمزنگاری شود.',
      'فایل پشتیبان با پسوند dastmozd. ساخته می‌شود؛ آن را در جای امن نگه دارید.',
      'برای بازگردانی، فایل را انتخاب کنید؛ صحت آن با SHA-256 بررسی و نتیجه گزارش می‌شود.',
    ],
    note: 'در نسخه دسکتاپ، نسخه‌های خودکار در پوشه %APPDATA%\\Dastmozd\\backups نگهداری می‌شود.',
    tags: ['پشتیبان', 'رمزنگاری', 'بازگردانی'],
  },
];

const FAQ: Array<{ question: string; answer: string }> = [
  {
    question: 'پایه سنوات چه زمانی پرداخت می‌شود؟',
    answer:
      'پایه سنوات برای کارکنانی است که یک سال کامل یا بیشتر در کارگاه سابقه دارند و در دوره‌های بعدی به میزان مقرر سال افزایش می‌یابد. مقدار سالانه در «تنظیمات ← پارامترهای سال» قابل ویرایش است.',
  },
  {
    question: 'چرا مالیات یک کارمند با محاسبه دستی من اختلاف دارد؟',
    answer:
      'سقف معافیت ماهانه، پلکان مالیات و معافیت‌های ماده ۹۱ (سنوات، هزینه سفر، عیدی تا سقف مقرر) اثر می‌گذارند. در پیش‌نمایش فیش، بخش «رهگیری محاسبه» ردیف‌های مشمول و معاف را با شرح نشان می‌دهد.',
  },
  {
    question: 'سقف بیمه چگونه اعمال می‌شود؟',
    answer:
      'سهم کارگر و کارفرما تا سقف هفت برابر حداقل مزد ماهانه محاسبه می‌شود؛ مازاد بر آن مشمول کسر بیمه نیست. این ضریب در پروفایل حقوقی هر سال تعریف شده است.',
  },
  {
    question: 'روی موبایل چطور نصب کنم؟',
    answer:
      'سامانه یک برنامه نصب‌شدنی است: در کروم اندروید گزینه «افزودن به صفحه اصلی» و در سافاری آیفون «افزودن به صفحه خانه» را انتخاب کنید. پس از نصب، برنامه بدون اتصال به اینترنت کار می‌کند.',
  },
  {
    question: 'داده‌های من کجا ذخیره می‌شود؟',
    answer:
      'همه داده‌ها در پایگاه‌داده محلی مرورگر یا برنامه دسکتاپ ذخیره می‌شود و هیچ اطلاعاتی بدون اجازه شما به سرور فرستاده نمی‌شود. برای انتقال، فایل پشتیبان بسازید.',
  },
  {
    question: 'کلیدهای میان‌بر نسخه دسکتاپ چیست؟',
    answer:
      'کارمند جدید با Ctrl+N، دوره حقوق جدید با Ctrl+P، پشتیبان‌گیری سریع با Ctrl+B و راهنمای کاربر با F1 باز می‌شود.',
  },
];

/** راهنمای درون‌برنامه‌ای: گام‌های راه‌اندازی، پرسش‌های متداول و ناوبری سریع. */
export default function HelpPage() {
  const [query, setQuery] = useState('');

  const topics = useMemo(() => {
    const needle = query.trim();
    if (!needle) return GETTING_STARTED;
    return GETTING_STARTED.filter((topic) =>
      `${topic.title} ${topic.steps.join(' ')} ${topic.tags.join(' ')}`.includes(needle),
    );
  }, [query]);

  const faq = useMemo(() => {
    const needle = query.trim();
    if (!needle) return FAQ;
    return FAQ.filter((item) => `${item.question} ${item.answer}`.includes(needle));
  }, [query]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="راهنمای کاربر"
        description="گام‌های راه‌اندازی سامانه، پاسخ پرسش‌های پرتکرار و مسیر رسیدن به هر بخش."
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
        actions={
          <Badge tone="primary">{toPersianDigits(GETTING_STARTED.length)} گام راه‌اندازی</Badge>
        }
      />

      <Alert tone="info" title="اولین بار است از سامانه استفاده می‌کنید؟">
        ترتیب پیشنهادی کار همان شش گام زیر است؛ با داده نمونه نیز می‌توانید همه بخش‌ها را بی‌خطر
        تمرین کنید (تنظیمات ← پشتیبان‌گیری ← بارگذاری داده نمونه).
      </Alert>

      <div className="max-w-md">
        <Input
          placeholder="جست‌وجو در راهنما… مثلاً: بیمه، اکسل، قفل دوره"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="جست‌وجو در راهنما"
        />
      </div>

      {topics.length === 0 && faq.length === 0 ? (
        <Alert tone="warning" title="نتیجه‌ای یافت نشد">
          عبارت دیگری را امتحان کنید یا از بخش «تنظیمات» راهنمای همان صفحه را ببینید.
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {topics.map((topic) => (
            <Card key={topic.id}>
              <CardHeader>
                <CardTitle>{topic.title}</CardTitle>
                <CardDescription>
                  {topic.tags.map((tag) => (
                    <Badge key={tag} tone="neutral" className="mr-1">
                      {tag}
                    </Badge>
                  ))}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="mr-5 list-decimal space-y-2 text-sm leading-7">
                  {topic.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {topic.note ? (
                  <p className="mt-3 rounded-[var(--dm-radius-md)] bg-[rgb(var(--dm-surface-sunken))] p-3 text-xs leading-6">
                    نکته: {topic.note}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>پرسش‌های متداول</CardTitle>
              <CardDescription>پاسخ‌های کوتاه بر پایه قوانین جاری و رفتار سامانه.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {faq.map((item) => (
                <details
                  key={item.question}
                  className="rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] p-3"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--dm-text))]">
                    {item.question}
                  </summary>
                  <p className="mt-2 text-xs leading-6 text-[rgb(var(--dm-text-muted))]">
                    {item.answer}
                  </p>
                </details>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>رفتن به بخش‌ها</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/employees">کارکنان</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/attendance">حضور و غیاب</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/payroll">محاسبه حقوق</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/reports">گزارش‌ها</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">تنظیمات</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
