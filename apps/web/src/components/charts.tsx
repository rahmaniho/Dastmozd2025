'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartPalette } from '@dastmozd/brand';
import { formatPersianNumber, toPersianDigits } from '@dastmozd/core';

const AXIS_STYLE = { fontSize: 11, fontFamily: 'Vazirmatn, Tahoma, sans-serif' };

function PersianTooltip({
  active,
  payload,
  label,
  suffix = 'ریال',
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      dir="rtl"
      className="rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] p-2.5 text-xs shadow-[var(--dm-shadow-md)]"
    >
      <p className="mb-1 font-bold text-[rgb(var(--dm-text))]">
        {toPersianDigits(String(label ?? ''))}
      </p>
      {payload.map((item, index) => (
        <p key={index} className="flex items-center justify-between gap-3">
          <span style={{ color: item.color }}>{item.name}</span>
          <span className="dm-numeric font-semibold">
            {formatPersianNumber(item.value ?? 0)} {suffix}
          </span>
        </p>
      ))}
    </div>
  );
}

export interface TrendPoint {
  month: string;
  gross: number;
  net: number;
  employerCost: number;
}

/** نمودار روند دوازده‌ماهه حقوق (راست‌چین، ارقام فارسی). */
export function PayrollTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-72 w-full" dir="rtl">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="dmTrendNet" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartPalette[0]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={chartPalette[0]} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="dmTrendCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartPalette[2]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={chartPalette[2]} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--dm-border))" vertical={false} />
          <XAxis
            dataKey="month"
            reversed
            tick={{ ...AXIS_STYLE, fill: 'rgb(var(--dm-text-muted))' }}
          />
          <YAxis
            orientation="right"
            tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}م`}
            tick={{ ...AXIS_STYLE, fill: 'rgb(var(--dm-text-muted))' }}
            width={54}
          />
          <Tooltip content={<PersianTooltip />} />
          <Legend
            formatter={(value: string) => <span style={{ fontSize: 12 }}>{value}</span>}
            wrapperStyle={{ fontFamily: 'Vazirmatn, Tahoma, sans-serif' }}
          />
          <Area
            type="monotone"
            dataKey="net"
            name="خالص پرداختی"
            stroke={chartPalette[0]}
            fill="url(#dmTrendNet)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="employerCost"
            name="هزینه کارفرما"
            stroke={chartPalette[2]}
            fill="url(#dmTrendCost)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DepartmentPoint {
  title: string;
  count: number;
}

/** نمودار توزیع دپارتمانی کارکنان. */
export function DepartmentChart({ data }: { data: DepartmentPoint[] }) {
  const filtered = data.filter((item) => item.count > 0);
  if (filtered.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[rgb(var(--dm-text-muted))]">
        هنوز کارمندی به دپارتمان‌ها تخصیص نیافته است.
      </p>
    );
  }
  return (
    <div className="h-72 w-full" dir="rtl">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="count"
            nameKey="title"
            innerRadius={54}
            outerRadius={92}
            paddingAngle={3}
            label={(entry: { title?: string; count?: number }) =>
              `${entry.title ?? ''} (${toPersianDigits(entry.count ?? 0)})`
            }
            labelLine={false}
          >
            {filtered.map((item, index) => (
              <Cell key={item.title} fill={chartPalette[index % chartPalette.length]} />
            ))}
          </Pie>
          <Tooltip content={<PersianTooltip suffix="نفر" />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface TaxBracketPoint {
  label: string;
  tax: number;
}

/** نمودار سهم پله‌های مالیات در یک دوره حقوقی. */
export function TaxBracketChart({ data }: { data: TaxBracketPoint[] }) {
  const filtered = data.filter((item) => item.tax > 0);
  if (filtered.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[rgb(var(--dm-text-muted))]">
        در این دوره هیچ مالیاتی تعلق نگرفته است؛ همه کارکنان زیر سقف معافیت هستند.
      </p>
    );
  }
  return (
    <div className="h-72 w-full" dir="rtl">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filtered} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--dm-border))" vertical={false} />
          <XAxis
            dataKey="label"
            reversed
            tick={{ ...AXIS_STYLE, fill: 'rgb(var(--dm-text-muted))' }}
          />
          <YAxis
            orientation="right"
            tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}م`}
            tick={{ ...AXIS_STYLE, fill: 'rgb(var(--dm-text-muted))' }}
            width={54}
          />
          <Tooltip content={<PersianTooltip />} />
          <Bar dataKey="tax" name="مالیات پله" fill={chartPalette[1]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
