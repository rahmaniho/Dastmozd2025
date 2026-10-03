import type { AttendanceRecord } from '@dastmozd/types';
import { upsertAttendance } from '../repositories/attendance';

/** ذخیره کارکرد از روی یک رکورد موجود — برای آزمون قفل دوره. */
export async function insertThroughUpsert(record: AttendanceRecord): Promise<AttendanceRecord> {
  const { id, createdAt, updatedAt, ...rest } = record;
  void id;
  void createdAt;
  void updatedAt;
  return upsertAttendance(rest);
}
