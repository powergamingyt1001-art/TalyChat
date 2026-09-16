'use client'

import { useAuth } from '@/lib/auth-store'

export class ApiError extends Error {
  status: number
  data: any
  constructor(message: string, status: number, data?: any) {
    super(message)
    this.status = status
    this.data = data
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuth.getState().token
  const headers = new Headers(options.headers)
  if (token) headers.set('x-user-id', token)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(path, { ...options, headers })
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new ApiError(data?.error || res.statusText, res.status, data)
  }
  return data as T
}

// File upload helper
export async function apiUpload<T = any>(
  path: string,
  file: File,
  fieldName = 'file'
): Promise<T> {
  const token = useAuth.getState().token
  const fd = new FormData()
  fd.append(fieldName, file)
  const res = await fetch(path, {
    method: 'POST',
    headers: token ? { 'x-user-id': token } : {},
    body: fd,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.error || 'Upload failed', res.status, data)
  return data as T
}
