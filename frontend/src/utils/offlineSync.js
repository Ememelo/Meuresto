// Utility for handling offline operations and synchronization

const SYNC_QUEUE_KEY = 'meuresto_sync_queue'

export const isOnline = () => {
  return typeof navigator !== 'undefined' && navigator.onLine
}

export const getSyncQueue = () => {
  try {
    const queue = localStorage.getItem(SYNC_QUEUE_KEY)
    return queue ? JSON.parse(queue) : []
  } catch (e) {
    console.error('Failed to read sync queue', e)
    return []
  }
}

export const saveSyncQueue = (queue) => {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to save sync queue', e)
  }
}

export const queueRequest = (method, url, data, description) => {
  const queue = getSyncQueue()
  const newItem = {
    id: Math.random().toString(36).substring(2, 9),
    method,
    url,
    data,
    description: description || `${method} ${url}`,
    timestamp: Date.now()
  }
  queue.push(newItem)
  saveSyncQueue(queue)
  
  // Dispatch custom event to notify components about the queue size change
  window.dispatchEvent(new CustomEvent('sync-queue-changed', { detail: { count: queue.length } }))
  return newItem.id
}

export const removeQueuedRequest = (id) => {
  let queue = getSyncQueue()
  queue = queue.filter(item => item.id !== id)
  saveSyncQueue(queue)
  window.dispatchEvent(new CustomEvent('sync-queue-changed', { detail: { count: queue.length } }))
}

export const clearSyncQueue = () => {
  localStorage.removeItem(SYNC_QUEUE_KEY)
  window.dispatchEvent(new CustomEvent('sync-queue-changed', { detail: { count: 0 } }))
}

// Function to process all queued requests when back online
export const syncPendingRequests = async (apiInstance) => {
  if (!isOnline() || !apiInstance) return { success: false, syncedCount: 0 }
  
  const queue = getSyncQueue()
  if (queue.length === 0) return { success: true, syncedCount: 0 }
  
  let syncedCount = 0
  let failed = false
  
  // Copy of the queue to process in sequence
  for (const item of [...queue]) {
    try {
      if (item.method === 'POST') {
        await apiInstance.post(item.url, item.data)
      } else if (item.method === 'PUT') {
        await apiInstance.put(item.url, item.data)
      } else if (item.method === 'DELETE') {
        await apiInstance.delete(item.url)
      }
      
      // If successful, remove from queue
      removeQueuedRequest(item.id)
      syncedCount++
    } catch (err) {
      console.error(`Sync failed for item ${item.id}:`, err)
      failed = true
      // Stop sync on error to preserve order of operations
      break
    }
  }
  
  return {
    success: !failed,
    syncedCount
  }
}
