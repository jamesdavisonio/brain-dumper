export const CATEGORIES = [
  'Work',
  'Personal',
  'Health',
  'Finance',
  'Shopping',
  'Home',
  'Learning',
  'Social',
  'Travel',
  'Admin',
] as const

export type Category = typeof CATEGORIES[number]

export const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const

export const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
] as const

export const PROJECT_ICONS = [
  'Briefcase',
  'Code',
  'Palette',
  'Rocket',
  'Heart',
  'Home',
  'ShoppingCart',
  'Book',
  'Dumbbell',
  'Plane',
  'Coffee',
  'Music',
  'Camera',
  'Zap',
  'Target',
] as const

export type ProjectColor = typeof PROJECT_COLORS[number]
export type ProjectIcon = typeof PROJECT_ICONS[number]
