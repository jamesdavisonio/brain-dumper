import { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { SignInCard } from './SignInCard'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/icon-transparent.svg"
            alt="Brain Dumper"
            className="h-12 w-12 animate-pulse"
          />
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <SignInCard />
  }

  return <>{children}</>
}
