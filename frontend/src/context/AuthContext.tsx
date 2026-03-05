import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import keycloak from '@/lib/keycloak'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  token: string | undefined
  userEmail: string | undefined
  userName: string | undefined
  login: () => void
  logout: () => void
  register: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(MOCK_AUTH)
  const [isLoading, setIsLoading] = useState(!MOCK_AUTH)

  useEffect(() => {
    if (MOCK_AUTH) return

    keycloak
      .init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        pkceMethod: 'S256',
      })
      .then((authenticated) => {
        setIsAuthenticated(authenticated)
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => {
        keycloak.login()
      })
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        token: MOCK_AUTH ? 'mock-token' : keycloak.token,
        userEmail: MOCK_AUTH ? 'dev@example.com' : (keycloak.tokenParsed?.email as string | undefined),
        userName: MOCK_AUTH ? 'Dev User' : ((keycloak.tokenParsed?.name ?? keycloak.tokenParsed?.preferred_username) as string | undefined),
        login: () => (MOCK_AUTH ? setIsAuthenticated(true) : keycloak.login()),
        logout: () => (MOCK_AUTH ? setIsAuthenticated(false) : keycloak.logout({ redirectUri: window.location.origin })),
        register: () => (MOCK_AUTH ? setIsAuthenticated(true) : keycloak.register()),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
