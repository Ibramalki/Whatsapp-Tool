import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Lead } from '../types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Replace {{name}}, {{phone}}, {{grade}} in a template string
export function resolveTemplate(content: string, lead: Pick<Lead, 'name' | 'phone' | 'grade'>): string {
  return content
    .replace(/\{\{name\}\}/g, lead.name || '')
    .replace(/\{\{phone\}\}/g, lead.phone || '')
    .replace(/\{\{grade\}\}/g, lead.grade || '')
}

// Format phone number: ensure it starts with + for display, strip non-digits for API
export function formatPhoneForAPI(phone: string): string {
  // Keep + if present, otherwise add it if it starts with a country code digit
  const digits = phone.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : `+${digits}`
}

export const STATUS_LABELS: Record<string, string> = {
  new: 'جديد',
  engaged: 'تفاعل',
  offered: 'عُرض عليه',
  converted: 'تحوّل',
}

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  engaged: 'bg-yellow-100 text-yellow-700',
  offered: 'bg-purple-100 text-purple-700',
  converted: 'bg-green-100 text-green-700',
}

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  running: 'جارٍ الإرسال',
  paused: 'متوقف',
  completed: 'مكتمل',
}

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
}
