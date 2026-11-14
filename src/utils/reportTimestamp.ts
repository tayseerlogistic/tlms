import { ksaDateISO } from './dateUtils';

/** A report belongs to its submission calendar day in Saudi Arabia. */
export function automaticReportDate(timestamp: unknown, formatDate: (date: Date) => string = ksaDateISO): string {
 if (!(timestamp instanceof Date) || !Number.isFinite(timestamp.getTime())) return '';
 return formatDate(timestamp);
}
