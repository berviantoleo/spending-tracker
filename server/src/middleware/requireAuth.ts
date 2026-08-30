import type { Request, Response, NextFunction } from 'express'
import { supabaseAnon } from '../lib/supabaseClient'

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = authHeader.slice(7)

  const { data, error } = await supabaseAnon.auth.getUser(token)

  if (error || !data.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  req.user = {
    id: data.user.id,
    email: data.user.email ?? '',
  }

  next()
}
