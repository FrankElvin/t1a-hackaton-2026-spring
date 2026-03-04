import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingBasket } from 'lucide-react'

const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, register } = useAuth()
  const navigate = useNavigate()
  const [nextRoute, setNextRoute] = useState<'/dashboard' | '/onboarding'>('/dashboard')

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(nextRoute, { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate, nextRoute])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  function handleLogin() {
    setNextRoute('/dashboard')
    login()
  }

  function handleRegister() {
    setNextRoute('/onboarding')
    register()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <ShoppingBasket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Household Planner</h1>
          <p className="text-gray-500 text-sm mt-1">Never run out of what matters</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>Sign in to manage your household resources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" size="lg" onClick={handleLogin}>
              Log in
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400">or</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" size="lg" onClick={handleRegister}>
              Create account
            </Button>
            <p className="text-center text-xs text-gray-400">
              {MOCK_AUTH ? 'Mock mode — no Keycloak needed' : 'Secure authentication powered by Keycloak'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
