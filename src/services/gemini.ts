import { GoogleGenerativeAI } from '@google/generative-ai'
import type { BrainDumpResult, ParsedTask, Priority, Recurrence } from '@/types'
import { CATEGORIES } from '@/lib/constants'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '')

interface FeedbackEntry {
  feedback: string
  createdAt: string
}

function getRecentFeedback(): string {
  try {
    const feedbackHistory = JSON.parse(localStorage.getItem('parsingFeedback') || '[]') as FeedbackEntry[]
    if (feedbackHistory.length === 0) return ''

    // Get last 5 feedback entries
    const recentFeedback = feedbackHistory.slice(0, 5).map((f) => `- ${f.feedback}`).join('\n')
    return `\nUSER FEEDBACK FROM PREVIOUS SESSIONS (apply these corrections):
${recentFeedback}\n`
  } catch {
    return ''
  }
}

function getSystemPrompt(existingProjects: string[]): string {
  const now = new Date()
  const currentDate = now.toISOString().split('T')[0]
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' })

  const projectsSection = existingProjects.length > 0
    ? `\nEXISTING PROJECTS: ${existingProjects.join(', ')}
When assigning tasks to projects, use EXACT names from this list when the user mentions something similar.
For example, if "Aria" exists and user writes "Area", use "Aria".
Only suggest new projects if they don't match any existing ones.\n`
    : ''

  const feedbackSection = getRecentFeedback()

  return `You are a task parser for a productivity app. Your job is to take a "brain dump" of unstructured text and extract individual tasks.
${feedbackSection}

IMPORTANT: Today is ${dayOfWeek}, ${currentDate}. Use this date as reference for all relative dates.
- "today" = ${currentDate}
- "tomorrow" = the next day after ${currentDate}
- When a day name is mentioned (Monday, Tuesday, etc.), it ALWAYS means the NEXT occurrence of that day in the FUTURE:
  * If today is Monday and user says "Monday", that means NEXT Monday (7 days from now), NOT today
  * If today is Tuesday and user says "Monday", that means the upcoming Monday (6 days from now)
  * The mentioned day is NEVER today - always at least 1 day in the future for the same day name
- "before [day]" means the day BEFORE that day:
  * "before Tuesday" = Monday (the day before the next Tuesday)
  * "before Friday" = Thursday (the day before the next Friday)
  * Calculate the next occurrence of the mentioned day, then subtract 1 day
- "next week" = 7 days from ${currentDate}
- "this weekend" = the upcoming Saturday/Sunday
${projectsSection}
CATEGORIES for auto-categorization: ${CATEGORIES.join(', ')}
Assign the most appropriate category to each task based on its content.

IMPORTANT - Distinguish between MULTI-DAY tasks vs RECURRING tasks:

MULTI-DAY tasks (create SEPARATE tasks for each day):
- "on Monday, Tuesday, and Wednesday" → Create 3 separate tasks, one for each day
- "for Tuesday, Wednesday and Thursday" → Create 3 separate tasks
- "task for Mon and Wed" → Create 2 separate tasks
- When multiple specific days are listed, create individual tasks

RECURRING tasks (single task with recurrence pattern):
- "every Monday" → Single task with weekly recurrence on Monday
- "daily" or "every day" → Single task with daily recurrence
- "weekly" or "every week" → Single task with weekly recurrence
- "every Monday and Wednesday" → Single task with weekly recurrence on those days
- When "every" or "weekly/daily/monthly" is used, create ONE recurring task

RECURRENCE patterns to detect:
- "every day", "daily" → { type: "daily", interval: 1 }
- "every week", "weekly" → { type: "weekly", interval: 1 }
- "every Monday" → { type: "weekly", interval: 1, daysOfWeek: [1] }
- "every Mon and Wed" → { type: "weekly", interval: 1, daysOfWeek: [1, 3] }
- "every month", "monthly" → { type: "monthly", interval: 1 }
- "every 2 weeks" → { type: "weekly", interval: 2 }
Days of week numbers: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

For each task, identify:
1. The task content (what needs to be done)
2. Any project it belongs to (if mentioned) - match to existing projects when possible
3. Priority (high, medium, low) - infer from urgency words
4. Due date (if mentioned, as ISO date string YYYY-MM-DD format)
5. Scheduled time (if time of day is mentioned, use 24-hour HH:MM format):
   - "morning" → "09:00"
   - "afternoon" → "14:00"
   - "evening" → "18:00"
   - Specific times like "3pm" → "15:00", "10:30am" → "10:30"
6. Time estimate in minutes (if mentioned or you can reasonably estimate)
7. Recurrence pattern (if this is a repeating task)
8. Category (auto-assign based on task content)

Priority inference rules:
- "urgent", "asap", "immediately", "critical" → high
- "soon", "this week", "important" → medium
- "eventually", "someday", "when possible", "low priority" → low
- Default to medium if no indication

Return a JSON object with this structure:
{
  "tasks": [
    {
      "content": "Task description",
      "project": "Project name or null",
      "priority": "high|medium|low",
      "dueDate": "YYYY-MM-DD or null",
      "scheduledTime": "HH:MM or null",
      "timeEstimate": 30,
      "recurrence": { "type": "weekly", "interval": 1, "daysOfWeek": [1] } or null,
      "category": "Work|Personal|Health|Finance|Shopping|Home|Learning|Social|Travel|Admin"
    }
  ],
  "suggestedProjects": ["Project1", "Project2"]
}

Be concise in task descriptions. Extract the actionable item.
If the input is unclear or empty, return an empty tasks array.
Only return valid JSON, no markdown or explanation.`
}

export async function parseBrainDump(
  text: string,
  existingProjects: string[] = []
): Promise<BrainDumpResult> {
  if (!text.trim()) {
    return { tasks: [], suggestedProjects: [] }
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent([
      { text: getSystemPrompt(existingProjects) },
      { text: `Parse this brain dump:\n\n${text}` },
    ])

    const response = result.response.text()

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    const parsed = JSON.parse(jsonStr)

    // Validate and sanitize the response
    const tasks: ParsedTask[] = (parsed.tasks || []).map((task: Record<string, unknown>) => ({
      content: String(task.content || ''),
      project: task.project ? String(task.project) : undefined,
      priority: validatePriority(task.priority),
      dueDate: task.dueDate ? String(task.dueDate) : undefined,
      scheduledTime: task.scheduledTime ? String(task.scheduledTime) : undefined,
      timeEstimate: typeof task.timeEstimate === 'number' ? task.timeEstimate : undefined,
      recurrence: validateRecurrence(task.recurrence),
      category: validateCategory(task.category),
    }))

    const suggestedProjects: string[] = (parsed.suggestedProjects || [])
      .filter((p: unknown): p is string => typeof p === 'string')

    return { tasks, suggestedProjects }
  } catch (error) {
    console.error('Error parsing brain dump with Gemini:', error)
    // Fallback to simple parsing
    return fallbackParser(text, existingProjects)
  }
}

function validatePriority(priority: unknown): Priority {
  if (priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority
  }
  return 'medium'
}

function validateRecurrence(recurrence: unknown): Recurrence | undefined {
  if (!recurrence || typeof recurrence !== 'object') return undefined

  const rec = recurrence as Record<string, unknown>
  const type = rec.type

  if (type !== 'daily' && type !== 'weekly' && type !== 'monthly' && type !== 'custom') {
    return undefined
  }

  const result: Recurrence = {
    type,
    interval: typeof rec.interval === 'number' ? rec.interval : 1,
  }

  if (Array.isArray(rec.daysOfWeek)) {
    result.daysOfWeek = rec.daysOfWeek.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
  }

  return result
}

function validateCategory(category: unknown): string | undefined {
  if (typeof category !== 'string') return undefined
  // Type assertion needed because CATEGORIES is readonly
  if ((CATEGORIES as readonly string[]).includes(category)) return category
  return undefined
}

// Fallback parser when Gemini is unavailable
function fallbackParser(text: string, existingProjects: string[] = []): BrainDumpResult {
  const lines = text.split('\n').filter((line) => line.trim())
  const tasks: ParsedTask[] = []
  const projectSet = new Set<string>()

  // Create lowercase map for fuzzy matching
  const projectMap = new Map(existingProjects.map((p) => [p.toLowerCase(), p]))

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Remove common list prefixes
    const content = trimmed
      .replace(/^[-*•]\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/^\[\s*\]\s*/, '')

    if (!content) continue

    // Detect priority from keywords
    let priority: Priority = 'medium'
    const lowerContent = content.toLowerCase()
    if (
      lowerContent.includes('urgent') ||
      lowerContent.includes('asap') ||
      lowerContent.includes('critical')
    ) {
      priority = 'high'
    } else if (
      lowerContent.includes('eventually') ||
      lowerContent.includes('someday') ||
      lowerContent.includes('low priority')
    ) {
      priority = 'low'
    }

    // Detect project from @ mentions or brackets
    let project: string | undefined
    const projectMatch = content.match(/@(\w+)/) || content.match(/\[([^\]]+)\]/)
    if (projectMatch) {
      const mentioned = projectMatch[1]
      // Try to match to existing project
      project = projectMap.get(mentioned.toLowerCase()) || mentioned
      projectSet.add(project)
    }

    // Detect recurrence patterns
    let recurrence: Recurrence | undefined
    if (lowerContent.includes('every day') || lowerContent.includes('daily')) {
      recurrence = { type: 'daily', interval: 1 }
    } else if (lowerContent.includes('every week') || lowerContent.includes('weekly')) {
      recurrence = { type: 'weekly', interval: 1 }
    } else if (lowerContent.includes('every month') || lowerContent.includes('monthly')) {
      recurrence = { type: 'monthly', interval: 1 }
    }

    // Simple category detection
    let category: string | undefined
    if (lowerContent.includes('work') || lowerContent.includes('meeting') || lowerContent.includes('project')) {
      category = 'Work'
    } else if (lowerContent.includes('gym') || lowerContent.includes('exercise') || lowerContent.includes('doctor')) {
      category = 'Health'
    } else if (lowerContent.includes('buy') || lowerContent.includes('shop') || lowerContent.includes('groceries')) {
      category = 'Shopping'
    } else if (lowerContent.includes('pay') || lowerContent.includes('bill') || lowerContent.includes('bank')) {
      category = 'Finance'
    } else if (lowerContent.includes('clean') || lowerContent.includes('fix') || lowerContent.includes('home')) {
      category = 'Home'
    } else {
      category = 'Personal'
    }

    tasks.push({
      content: content
        .replace(/@\w+/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .trim(),
      project,
      priority,
      recurrence,
      category,
    })
  }

  return {
    tasks,
    suggestedProjects: Array.from(projectSet),
  }
}
