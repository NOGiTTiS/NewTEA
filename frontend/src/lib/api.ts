const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    if (
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
      window.location.port === '3000'
    ) {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
    }
    return ''
  }
  return process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://tea-backend:8080'
}

const API_BASE = getApiBaseUrl()

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('fetch failed')) {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ NewTEA Backend ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์กำลังทำงาน')
    }
    throw err
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `HTTP error ${res.status}`)
  }

  return res.json()
}

export async function uploadApi<T>(path: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('fetch failed')) {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ NewTEA Backend ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์กำลังทำงาน')
    }
    throw err
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `HTTP error ${res.status}`)
  }

  return res.json()
}

export async function uploadFileApi<T>(path: string, file: File): Promise<T> {
  const formData = new FormData()
  formData.append('file', file)
  return uploadApi<T>(path, formData)
}
