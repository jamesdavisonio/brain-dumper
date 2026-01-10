import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTasks } from '@/context/TaskContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, X, ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import type { ParsedTask, Priority } from '@/types'

export function ApprovalScreen() {
  const navigate = useNavigate()
  const { bulkAddTasks, addProject, projects } = useTasks()
  const [tasks, setTasks] = useState<ParsedTask[]>([])
  const [suggestedProjects, setSuggestedProjects] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  useEffect(() => {
    const storedTasks = sessionStorage.getItem('parsedTasks')
    const storedProjects = sessionStorage.getItem('suggestedProjects')

    if (!storedTasks) {
      navigate('/')
      return
    }

    setTasks(JSON.parse(storedTasks))
    if (storedProjects) {
      setSuggestedProjects(JSON.parse(storedProjects))
    }
  }, [navigate])

  const handleUpdateTask = (index: number, updates: Partial<ParsedTask>) => {
    setTasks((prev) =>
      prev.map((task, i) => (i === index ? { ...task, ...updates } : task))
    )
  }

  const handleRemoveTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return
    await addProject(newProjectName.trim())
    setNewProjectName('')
  }

  const handleSaveAll = async () => {
    if (tasks.length === 0) return

    setIsSaving(true)
    try {
      // Create any new projects from suggestions that don't exist
      const existingProjectNames = projects.map((p) => p.name.toLowerCase())
      const newProjects = suggestedProjects.filter(
        (p) => !existingProjectNames.includes(p.toLowerCase())
      )

      for (const projectName of newProjects) {
        await addProject(projectName)
      }

      // Create tasks
      const tasksToAdd = tasks.map((task, index) => ({
        content: task.content,
        project: task.project,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        timeEstimate: task.timeEstimate,
        completed: false,
        archived: false,
        order: index,
      }))

      await bulkAddTasks(tasksToAdd)

      // Clear session storage
      sessionStorage.removeItem('parsedTasks')
      sessionStorage.removeItem('suggestedProjects')
      sessionStorage.removeItem('originalInput')

      navigate('/list')
    } catch (error) {
      console.error('Failed to save tasks:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    sessionStorage.removeItem('parsedTasks')
    sessionStorage.removeItem('suggestedProjects')
    sessionStorage.removeItem('originalInput')
    navigate('/')
  }

  if (tasks.length === 0) {
    return null
  }

  const allProjects = [
    ...new Set([
      ...projects.map((p) => p.name),
      ...suggestedProjects,
    ]),
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Review Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} tasks extracted. Edit before saving.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task, index) => (
          <Card key={index}>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Input
                    value={task.content}
                    onChange={(e) =>
                      handleUpdateTask(index, { content: e.target.value })
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveTask(index)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Select
                    value={task.priority}
                    onValueChange={(value: Priority) =>
                      handleUpdateTask(index, { priority: value })
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">
                        <span className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                          High
                        </span>
                      </SelectItem>
                      <SelectItem value="medium">
                        <span className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-yellow-500" />
                          Medium
                        </span>
                      </SelectItem>
                      <SelectItem value="low">
                        <span className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          Low
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={task.project || 'none'}
                    onValueChange={(value) =>
                      handleUpdateTask(index, {
                        project: value === 'none' ? undefined : value,
                      })
                    }
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Project</SelectItem>
                      {allProjects.map((project) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {task.dueDate && (
                    <Badge variant="outline">{task.dueDate}</Badge>
                  )}

                  {task.timeEstimate && (
                    <Badge variant="secondary">{task.timeEstimate}m</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {suggestedProjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Suggested Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestedProjects.map((project) => {
                const exists = projects.some(
                  (p) => p.name.toLowerCase() === project.toLowerCase()
                )
                return (
                  <Badge
                    key={project}
                    variant={exists ? 'secondary' : 'outline'}
                  >
                    {project}
                    {exists && <Check className="ml-1 h-3 w-3" />}
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new project..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddProject()}
            />
            <Button onClick={handleAddProject} disabled={!newProjectName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button onClick={handleSaveAll} disabled={isSaving || tasks.length === 0}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Save {tasks.length} Tasks
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
