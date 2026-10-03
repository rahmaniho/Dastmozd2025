import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from '@dastmozd/ui';

export const metadata: Metadata = {
  title: 'دریافت فایل از اشتراک‌گذاری',
  description: 'راهنمای ارسال فایل اکسل کارکرد یا کارکنان به برنامه دستمزد آرمانی.',
};

/** صفحه راهنما برای وقتی که اشتراک‌گذاری بدون فایل انجام شده است. */
export default function ShareTargetPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="اشتراک‌گذاری فایل با دستمزد آرمانی"
        description="این صفحه فقط با ارسال فایل از منوی «اشتراک‌گذاری» سیستم مدیریت‌عامل پر می‌شود."
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
      />
      <Card>
        <CardHeader>
          <CardTitle>فایلی دریافت نشد</CardTitle>
          <CardDescription>
            برای ارسال فایل، در گوشی یا رایانه روی فایل اکسل کارکرد یا کارکنان بزنید، گزینه «اشتراک‌گذاری» را انتخاب
            کنید و برنامه «دستمزد آرمانی» را برگزینید. مرورگر فایل را به سامانه می‌فرستد و پس از تشخیص ساختار، امکان
            ثبت گروهی فراهم می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/attendance">ورود کارکرد از فایل</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/employees">ورود کارکنان از فایل</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
