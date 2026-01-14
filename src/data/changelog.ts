export interface ChangelogEntry {
  version: string
  date: string // ISO date string
  title: string
  changes: {
    type: 'feature' | 'improvement' | 'fix'
    description: string
  }[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.2.0',
    date: '2025-01-14',
    title: 'Navigation Update & Changelog',
    changes: [
      { type: 'feature', description: 'Added Changelog to track app updates' },
      { type: 'improvement', description: 'Moved Stats and Archive to account menu for cleaner navigation' },
      { type: 'improvement', description: 'Updated app logos' },
    ],
  },
  {
    version: '1.1.0',
    date: '2025-01-14',
    title: 'Schedule View Improvements',
    changes: [
      { type: 'feature', description: 'Daily task notifications via Cloud Functions' },
      { type: 'improvement', description: 'Schedule view now shows 3 days at a time' },
      { type: 'improvement', description: 'Added 4 time sections per day: Unscheduled, Morning, Afternoon, Evening' },
      { type: 'improvement', description: 'Full day names and time estimates in schedule' },
      { type: 'improvement', description: 'Tasks without dates auto-assigned to today' },
      { type: 'fix', description: 'Fixed mobile notifications using Service Worker' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-01-13',
    title: 'Initial Release',
    changes: [
      { type: 'feature', description: 'Brain dump input with AI processing' },
      { type: 'feature', description: 'Task list with priorities and due dates' },
      { type: 'feature', description: 'Schedule view for planning your week' },
      { type: 'feature', description: 'Analytics dashboard' },
      { type: 'feature', description: 'Archive for completed tasks' },
      { type: 'feature', description: 'Google Sign-In authentication' },
      { type: 'feature', description: 'Progressive Web App (PWA) support' },
    ],
  },
]

export const CURRENT_VERSION = CHANGELOG[0].version
