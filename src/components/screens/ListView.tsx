import { useState, useMemo } from 'react'
import { useTasks } from '@/context/TaskContext'
import { TaskCard } from '@/components/tasks/TaskCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Filter, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react'
import type { Priority } from '@/types'

export function ListView() {
  const { tasks, projects, loading } = useTasks()
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  const toggleProjectCollapse = (projectName: string) => {
    setCollapsedProjects((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(projectName)) {
        newSet.delete(projectName)
      } else {
        newSet.add(projectName)
      }
      return newSet
    })
  }

  const activeTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.archived && !t.completed)
      .filter((t) => {
        if (search) {
          return t.content.toLowerCase().includes(search.toLowerCase())
        }
        return true
      })
      .filter((t) => {
        if (priorityFilter !== 'all') {
          return t.priority === priorityFilter
        }
        return true
      })
      .filter((t) => {
        if (projectFilter !== 'all') {
          return t.project === projectFilter
        }
        return true
      })
  }, [tasks, search, priorityFilter, projectFilter])

  const completedTasks = useMemo(() => {
    return tasks.filter((t) => t.completed && !t.archived)
  }, [tasks])

  const tasksByProject = useMemo(() => {
    const grouped: Record<string, typeof activeTasks> = {
      'No Project': [],
    }

    projects.forEach((p) => {
      grouped[p.name] = []
    })

    activeTasks.forEach((task) => {
      const key = task.project || 'No Project'
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(task)
    })

    return grouped
  }, [activeTasks, projects])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as Priority | 'all')}
          >
            <SelectTrigger className="w-[130px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[150px]">
              <FolderOpen className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="none">No Project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.name}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All ({activeTasks.length})
          </TabsTrigger>
          <TabsTrigger value="by-project" className="flex-1">
            By Project
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            Done ({completedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {activeTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No tasks yet. Start with a brain dump!</p>
            </div>
          ) : (
            activeTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))
          )}
        </TabsContent>

        <TabsContent value="by-project" className="space-y-6 mt-4">
          {Object.entries(tasksByProject).map(([projectName, projectTasks]) => {
            if (projectTasks.length === 0) return null
            const project = projects.find((p) => p.name === projectName)
            const isCollapsed = collapsedProjects.has(projectName)

            return (
              <div key={projectName}>
                <Button
                  variant="ghost"
                  className="w-full justify-start mb-3 hover:bg-transparent p-0 h-auto"
                  onClick={() => toggleProjectCollapse(projectName)}
                >
                  <h3
                    className="font-medium flex items-center gap-2"
                    style={{ color: project?.color }}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: project?.color || '#888' }}
                    />
                    {projectName} ({projectTasks.length})
                  </h3>
                </Button>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {projectTasks.map((task) => (
                      <TaskCard key={task.id} task={task} showProject={false} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          {completedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No completed tasks yet.</p>
            </div>
          ) : (
            completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
