import { GoogleGenerativeAI } from '@google/generative-ai'
import type { BrainDumpResult, ParsedTask, Priority } from '@/types'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '')

const SYSTEM_PROMPT = `You are a task parser for a productivity app. Your job is to take a "brain dump" of unstructured text and extract individual tasks.

For each task, identify:
1. The task content (what needs to be done)
2. Any project it belongs to (if mentioned)
3. Priority (high, medium, low) - infer from urgency words
4. Due date (if mentioned, as ISO date string)
5. Time estimate in minutes (if mentioned or you can reasonably estimate)

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
      "dueDate": "2024-01-15 or null",
      "timeEstimate": 30
    }
  ],
  "suggestedProjects": ["Project1", "Project2"]
}

Be concise in task descriptions. Extract the actionable item.
If the input is unclear or empty, return an empty tasks array.
Only return valid JSON, no markdown or explanation.`

export async function parseBrainDump(text: string): Promise<BrainDumpResult> {
  if (!text.trim()) {
    return { tasks: [], suggestedProjects: [] }
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
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
      timeEstimate: typeof task.timeEstimate === 'number' ? task.timeEstimate : undefined,
    }))

    const suggestedProjects: string[] = (parsed.suggestedProjects || [])
      .filter((p: unknown): p is string => typeof p === 'string')

    return { tasks, suggestedProjects }
  } catch (error) {
    console.error('Error parsing brain dump with Gemini:', error)
    // Fallback to simple parsing
    return fallbackParser(text)
  }
}

function validatePriority(priority: unknown): Priority {
  if (priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority
  }
  return 'medium'
}

// Fallback parser when Gemini is unavailable
function fallbackParser(text: string): BrainDumpResult {
  const lines = text.split('\n').filter((line) => line.trim())
  const tasks: ParsedTask[] = []
  const projectSet = new Set<string>()

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
      project = projectMatch[1]
      projectSet.add(project)
    }

    tasks.push({
      content: content
        .replace(/@\w+/g, '')
        .replace(/\[[^\]]+\]/g, '')
        .trim(),
      project,
      priority,
    })
  }

  return {
    tasks,
    suggestedProjects: Array.from(projectSet),
  }
}
