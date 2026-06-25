import axios from 'axios'
import { isOnline, queueRequest } from './offlineSync'

const api = axios.create({
  baseURL: '/api'
})

// Request Interceptor to append JWT token and handle offline writes
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('lira_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    // If offline and making a write request (POST, PUT, DELETE), we queue it
    if (!isOnline() && ['post', 'put', 'delete'].includes(config.method?.toLowerCase())) {
      const desc = `${config.method.toUpperCase()} ${config.url}`
      const tempId = queueRequest(config.method.toUpperCase(), config.url, config.data, desc)
      
      // Cancel the actual request by throwing a custom offline error
      const cancelError = new Error('Offline Write Queued')
      cancelError.isOfflineWrite = true
      cancelError.tempId = tempId
      cancelError.config = config
      throw cancelError
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response Interceptor to cache GETs, fallback to cache on GET failure, and handle offline write responses
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method?.toLowerCase() === 'get') {
      const cacheKey = `meuresto_cache_${response.config.url}_${JSON.stringify(response.config.params || {})}`
      try {
        localStorage.setItem(cacheKey, JSON.stringify(response.data))
      } catch (e) {
        console.warn('Failed to cache GET response', e)
      }
    }
    return response
  },
  (error) => {
    // Handle the custom offline write cancellation
    if (error.isOfflineWrite) {
      return {
        data: {
          id: error.tempId,
          offline: true,
          ...error.config.data
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: error.config
      }
    }

    const { config, response } = error

    // Catch 401 Unauthorized
    if (response && response.status === 401) {
      localStorage.removeItem('lira_token')
      localStorage.removeItem('lira_user')
      if (window.location.pathname !== '/login' && window.location.pathname !== '') {
        window.location.href = '/'
      }
      return Promise.reject(error)
    }

    // Catch Network Errors on GET requests (meaning offline or server unreachable)
    if (!response && config && config.method?.toLowerCase() === 'get') {
      const cacheKey = `meuresto_cache_${config.url}_${JSON.stringify(config.params || {})}`
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        return {
          data: JSON.parse(cachedData),
          status: 200,
          statusText: 'OK',
          headers: {},
          config: config,
          isCached: true
        }
      }
    }

    // Catch Network Errors on write requests (server unreachable/offline)
    if (!response && config && ['post', 'put', 'delete'].includes(config.method?.toLowerCase())) {
      const desc = `${config.method.toUpperCase()} ${config.url}`
      let parsedData = config.data
      if (typeof config.data === 'string') {
        try {
          parsedData = JSON.parse(config.data)
        } catch (e) {}
      }
      const tempId = queueRequest(config.method.toUpperCase(), config.url, parsedData, desc)
      return {
        data: {
          id: tempId,
          offline: true,
          ...parsedData
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config
      }
    }

    return Promise.reject(error)

  }
)

export default api

