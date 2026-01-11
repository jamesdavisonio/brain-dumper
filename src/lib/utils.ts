import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { PROJECT_COLORS, PROJECT_ICONS } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatTimeEstimate(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return 'text-red-500 bg-red-500/10'
    case 'medium':
      return 'text-yellow-500 bg-yellow-500/10'
    case 'low':
      return 'text-green-500 bg-green-500/10'
  }
}

export function getProjectColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length]
}

export function getProjectIcon(index: number): string {
  return PROJECT_ICONS[index % PROJECT_ICONS.length]
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export type OSType = 'android' | 'ios' | 'mac' | 'windows' | 'linux' | 'unknown'

export function detectOS(): OSType {
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (/android/.test(userAgent)) {
    return 'android'
  }
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios'
  }
  if (/mac/.test(platform)) {
    return 'mac'
  }
  if (/win/.test(platform)) {
    return 'windows'
  }
  if (/linux/.test(platform)) {
    return 'linux'
  }
  return 'unknown'
}
