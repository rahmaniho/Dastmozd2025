/**
 * @dastmozd/ui — کتابخانه اجزای مشترک راست‌چین
 *
 * اجزا بر پایه shadcn/ui (Radix + Tailwind) ساخته شده‌اند تا در همه بسترها
 * (وب، PWA و دسکتاپ Tauri) یک ظاهر و یک رفتار داشته باشند.
 */
export { cn } from './lib/cn';

export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/card';

export { Checkbox, FormField, Input, Label, Select, Switch, Textarea } from './components/form';
export type {
  CheckboxProps,
  FormFieldProps,
  InputProps,
  SelectProps,
  SwitchProps,
} from './components/form';

export {
  Alert,
  Badge,
  EmptyState,
  Progress,
  Separator,
  Skeleton,
  TableSkeleton,
} from './components/feedback';
export type { AlertProps, BadgeProps, EmptyStateProps, ProgressProps } from './components/feedback';

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
} from './components/table';
export type { TabsProps } from './components/table';

export {
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from './components/dialog';
export type { DialogContentProps, ConfirmDialogProps } from './components/dialog';

export { ToastProvider, useToast } from './components/toast';
export type { Toast, ToastTone } from './components/toast';

export { JalaliDateText, Money, MoneyShort, PageHeader, StatCard } from './components/data-display';
export type { MoneyProps, PageHeaderProps, StatCardProps } from './components/data-display';

export {
  IllustrationAttendance,
  IllustrationEmployees,
  IllustrationError,
  IllustrationNoResults,
  IllustrationPayroll,
  IllustrationReports,
  IllustrationWelcome,
  illustrations,
} from './components/illustrations';
