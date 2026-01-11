import {
  Briefcase,
  Code,
  Palette,
  Rocket,
  Heart,
  Home,
  ShoppingCart,
  Book,
  Dumbbell,
  Plane,
  Coffee,
  Music,
  Camera,
  Zap,
  Target,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  Briefcase,
  Code,
  Palette,
  Rocket,
  Heart,
  Home,
  ShoppingCart,
  Book,
  Dumbbell,
  Plane,
  Coffee,
  Music,
  Camera,
  Zap,
  Target,
}

interface ProjectIconProps {
  icon?: string
  className?: string
  color?: string
}

export function ProjectIcon({ icon, className = 'h-4 w-4', color }: ProjectIconProps) {
  if (!icon) return null

  const Icon = iconMap[icon]
  if (!Icon) return null

  return <Icon className={className} style={{ color }} />
}
