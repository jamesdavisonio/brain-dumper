import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, CheckCheck, Archive, Trash2, FolderOpen, Flag, X } from 'lucide-react'
import type { Priority } from '@/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useState } from 'react'

interface BulkActionBarProps {
  selectedCount: number
  onComplete: () => void
  onUncomplete: () => void
  onArchive: () => void
  onDelete: () => void
  onChangePriority: (priority: Priority) => void
  onChangeProject: (project: string | null) => void
  onCancel: () => void
  projects: string[]
}

export function BulkActionBar({
  selectedCount,
  onComplete,
  onUncomplete,
  onArchive,
  onDelete,
  onChangePriority,
  onChangeProject,
  onCancel,
  projects,
}: BulkActionBarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDelete = () => {
    onDelete()
    setShowDeleteDialog(false)
  }

  if (selectedCount === 0) return null

  return (
    <>
      <div className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {selectedCount} selected
              </Badge>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Complete/Uncomplete */}
              <Button variant="outline" size="sm" onClick={onComplete}>
                <Check className="mr-2 h-4 w-4" />
                Complete
              </Button>

              <Button variant="outline" size="sm" onClick={onUncomplete}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Uncomplete
              </Button>

              {/* Archive */}
              <Button variant="outline" size="sm" onClick={onArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>

              {/* Change Priority */}
              <Select onValueChange={(value) => onChangePriority(value as Priority)}>
                <SelectTrigger className="w-[140px] h-9">
                  <Flag className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              {/* Change Project */}
              <Select onValueChange={(value) => onChangeProject(value === 'none' ? null : value)}>
                <SelectTrigger className="w-[140px] h-9">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Delete */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>

              {/* Cancel */}
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} Tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} task{selectedCount > 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
