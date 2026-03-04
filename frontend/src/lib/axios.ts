import axios from 'axios'
import keycloak from './keycloak'

const api = axios.create({
  baseURL: '/api/v1',
})

let isRedirecting = false

api.interceptors.request.use(async (config) => {
  if (isRedirecting) {
    return Promise.reject(new axios.Cancel('Redirecting to login'))
  }
  if (keycloak.token) {
    try {
      await keycloak.updateToken(30)
    } catch {
      if (!isRedirecting) {
        isRedirecting = true
        keycloak.login()
      }
      return Promise.reject(new axios.Cancel('Token expired'))
    }
    config.headers.Authorization = `Bearer ${keycloak.token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true
      keycloak.login()
    }
    return Promise.reject(error)
  }
)

export default api
