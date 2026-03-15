// components/StoreInitializer.tsx
// Self-initializing component: loads auth session → profile → sets workspaceId.
// Mount this inside any AuthGuard-wrapped route so page refreshes work without
// needing to pass through App.tsx's initStore().
import { useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

export function StoreInitializer() {
  const { workspaceId, setUser, setWorkspaceId } = useReachStore()

  useEffect(() => {
    if (workspaceId) return // already initialised (e.g. navigated from App.tsx)
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (profile) {
        setUser(profile)
        setWorkspaceId(profile.default_workspace_id ?? profile.tenant_id)
      }
    })
  }, [])

  return null
}
