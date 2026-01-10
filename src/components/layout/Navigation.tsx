import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Plus, List, Calendar, Archive, BarChart3 } from 'lucide-react'

const navItems = [
  { path: '/', icon: Plus, label: 'Dump' },
  { path: '/list', icon: List, label: 'Tasks' },
  { path: '/timeline', icon: Calendar, label: 'Schedule' },
  { path: '/analytics', icon: BarChart3, label: 'Stats' },
  { path: '/archive', icon: Archive, label: 'Archive' },
]

export function Navigation() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="container flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function DesktopNavigation() {
  const location = useLocation()

  return (
    <nav className="hidden md:flex items-center gap-1 px-4">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
