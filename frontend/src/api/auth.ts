import client from './client'

export interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await client.post('/auth/login', { email, password })
  return res.data
}

export async function fetchMe(): Promise<User> {
  const res = await client.get('/auth/me')
  return res.data
}
