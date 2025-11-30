import { Link } from '@tanstack/react-router'
import { useAuth } from '~/lib/auth'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center gap-3 px-2 py-4 text-xl font-semibold">
                <img 
                  src="/images/logo.png" 
                  alt="RL Studio Logo" 
                  className="h-8 w-8"
                />
                RL Studio
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                  activeProps={{ className: 'text-foreground border-b-2 border-primary' }}
                >
                  Dashboard
                </Link>
                <Link
                  to="/environments"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                  activeProps={{ className: 'text-foreground border-b-2 border-primary' }}
                >
                  Environments
                </Link>
                <Link
                  to="/runs"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                  activeProps={{ className: 'text-foreground border-b-2 border-primary' }}
                >
                  Runs
                </Link>
                <Link
                  to="/settings"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                  activeProps={{ className: 'text-foreground border-b-2 border-primary' }}
                >
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <>
                  <Link
                    to="/settings"
                    className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                  >
                    {user.displayName}
                  </Link>
                  <button
                    onClick={signOut}
                    className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}

