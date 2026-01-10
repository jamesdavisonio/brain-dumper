import { ReactNode } from 'react'
import { Header } from './Header'
import { Navigation, DesktopNavigation } from './Navigation'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="hidden md:block border-b">
        <div className="container">
          <DesktopNavigation />
        </div>
      </div>
      <main className="container py-4 pb-20 md:pb-4">{children}</main>
      <Navigation />
    </div>
  )
}
