import { useState, useMemo } from 'react'
import { useTasks } from '@/context/TaskContext'
import { SelectableTaskCard } from '@/components/tasks/SelectableTaskCard'
import { BulkActionBar } from '@/components/tasks/BulkActionBar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Filter, FolderOpen, ChevronDown, ChevronRight, Edit, CheckSquare, Tag, ArrowUpDown } from 'lucide-react'
import type { Priority } from '@/types'
import { CATEGORIES } from '@/lib/constants'

export function ListView() {
  const { tasks, projects, loading, updateProject, updateTask, deleteTask } = useTasks()
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt'>('createdAt')
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [editingProject, setEditingProject] = useState<{ id: string; name: string } | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())

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

  const handleEditProject = (projectId: string, projectName: string) => {
    setEditingProject({ id: projectId, name: projectName })
    setNewProjectName(projectName)
  }

  const handleSaveProjectName = async () => {
    if (editingProject && newProjectName.trim() && newProjectName !== editingProject.name) {
      await updateProject(editingProject.id, { name: newProjectName.trim() })
    }
    setEditingProject(null)
    setNewProjectName('')
  }

  const handleSelectionChange = (taskId: string, selected: boolean) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(taskId)
      } else {
        newSet.delete(taskId)
      }
      return newSet
    })
  }

  const handleBulkComplete = async () => {
    for (const taskId of selectedTasks) {
      await updateTask(taskId, { completed: true })
    }
    setSelectedTasks(new Set())
    setSelectionMode(false)
  }

  const handleBulkUncomplete = async () => {
    for (const taskId of selectedTasks) {
      await updateTask(taskId, { completed: false })
    }
    setSelectedTasks(new Set())
    setSelectionMode(false)
  }

  const handleBulkArchive = async () => {
    for (const taskId of selectedTasks) {
      await updateTask(taskId, { archived: true })
    }
    setSelectedTasks(new Set())
    setSelectionMode(false)
  }

  const handleBulkDelete = async () => {
    for (const taskId of selectedTasks) {
      await deleteTask(taskId)
    }
    setSelectedTasks(new Set())
    setSelectionMode(false)
  }

  const handleBulkChangePriority = async (priority: Priority) => {
    for (const taskId of selectedTasks) {
      await updateTask(taskId, { priority })
    }
    setSelectedTasks(new Set())
    setSelectionMode(false)
  }

  const handleBulkChangeProject = async (project: string | null) => {
    for (const taskId of selectedTasks) {
      await updateTask(taskId, { project: project || undefined })
    }
    setSelectedTasks(new Set())
    setSelectionMode(false)
  }

  const handleCancelSelection = () => {
    setSelectedTasks(new Set())
    setSelectionMode(false)
  }

  const activeTasks = useMemo(() => {
    const filtered = tasks
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
      .filter((t) => {
        if (categoryFilter !== 'all') {
          return t.category === categoryFilter
        }
        return true
      })

    // Sort tasks
    filtered.sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      if (sortBy === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      // Default: createdAt
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return filtered
  }, [tasks, search, priorityFilter, projectFilter, categoryFilter, sortBy])

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

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <Tag className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Recent</SelectItem>
              <SelectItem value="dueDate">Due Date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={selectionMode ? 'default' : 'outline'}
            size="icon"
            onClick={() => {
              setSelectionMode(!selectionMode)
              setSelectedTasks(new Set())
            }}
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
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
              <SelectableTaskCard
                key={task.id}
                task={task}
                selectionMode={selectionMode}
                isSelected={selectedTasks.has(task.id)}
                onSelectionChange={handleSelectionChange}
              />
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
                <div className="flex items-center justify-between mb-3">
                  <Button
                    variant="ghost"
                    className="flex-1 justify-start hover:bg-transparent p-0 h-auto"
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
                  {project && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditProject(project.id, projectName)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {projectTasks.map((task) => (
                      <SelectableTaskCard
                        key={task.id}
                        task={task}
                        showProject={false}
                        selectionMode={selectionMode}
                        isSelected={selectedTasks.has(task.id)}
                        onSelectionChange={handleSelectionChange}
                      />
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
              <SelectableTaskCard
                key={task.id}
                task={task}
                selectionMode={selectionMode}
                isSelected={selectedTasks.has(task.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project Name</DialogTitle>
            <DialogDescription>
              Update the name of this project. All tasks will remain associated with it.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveProjectName()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProjectName} disabled={!newProjectName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedTasks.size}
        onComplete={handleBulkComplete}
        onUncomplete={handleBulkUncomplete}
        onArchive={handleBulkArchive}
        onDelete={handleBulkDelete}
        onChangePriority={handleBulkChangePriority}
        onChangeProject={handleBulkChangeProject}
        onCancel={handleCancelSelection}
        projects={projects.map((p) => p.name)}
      />
    </div>
  )
}
