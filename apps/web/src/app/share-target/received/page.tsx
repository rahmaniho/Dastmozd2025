import type { Metadata } from 'next';
import { PageHeader } from '@dastmozd/ui';
import { ShareTargetImporter } from '@/components/share-target-importer';

export const metadata: Metadata = {
  title: 'ورود فایل اشتراک‌گذاری‌شده',
  description: 'ثبت گروهی کارکنان یا کارکرد از فایل اکسل ارسال‌شده با «اشتراک‌گذاری» سیستم.',
};

export default function ShareTargetReceivedPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="ورود داده از فایل اشتراک‌گذاری‌شده"
        description="فایل دریافتی بررسی می‌شود؛ پیش از ثبت، تعداد سطرهای معتبر و خطاها نمایش داده می‌شود."
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
      />
      <ShareTargetImporter />
    </div>
  );
}
