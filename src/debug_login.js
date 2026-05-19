import { loginUser as apiLoginUser } from './api.js'

export async function loginUser(u, p) {
  return apiLoginUser(u, p)
}
