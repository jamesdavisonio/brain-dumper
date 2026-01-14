import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Sparkles, Wrench, Bug, History } from 'lucide-react'
import { CHANGELOG } from '@/data/changelog'
import { format } from 'date-fns'

const CHANGE_ICONS = {
  feature: Sparkles,
  improvement: Wrench,
  fix: Bug,
}

const CHANGE_COLORS = {
  feature: 'bg-green-500/10 text-green-600 dark:text-green-400',
  improvement: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  fix: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

export function ChangelogView() {
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 py-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Changelog
          </h1>
          <p className="text-sm text-muted-foreground">
            See what's new in Brain Dumper
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`p-1 rounded ${CHANGE_COLORS.feature}`}>
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="text-muted-foreground">New Feature</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`p-1 rounded ${CHANGE_COLORS.improvement}`}>
            <Wrench className="h-3 w-3" />
          </span>
          <span className="text-muted-foreground">Improvement</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`p-1 rounded ${CHANGE_COLORS.fix}`}>
            <Bug className="h-3 w-3" />
          </span>
          <span className="text-muted-foreground">Bug Fix</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        {CHANGELOG.map((entry, idx) => (
          <Card key={entry.version} className={idx === 0 ? 'border-primary' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  v{entry.version}
                  {idx === 0 && (
                    <Badge variant="default" className="text-xs">
                      Latest
                    </Badge>
                  )}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {format(new Date(entry.date), 'MMMM d, yyyy')}
                </span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">{entry.title}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {entry.changes.map((change, changeIdx) => {
                  const Icon = CHANGE_ICONS[change.type]
                  return (
                    <li key={changeIdx} className="flex items-start gap-3">
                      <span className={`p-1 rounded flex-shrink-0 ${CHANGE_COLORS[change.type]}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="text-sm">{change.description}</span>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
