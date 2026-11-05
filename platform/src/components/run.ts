import { toast } from 'sonner'

type R = { ok: true; message?: string } | { ok: false; error: string }

/** Show a toast for an action result and return whether it succeeded. */
export function run(r: R, success?: string) {
  if (r.ok) {
    if (r.message || success) toast.success(r.message ?? success)
    return true
  }
  toast.error(r.error)
  return false
}
