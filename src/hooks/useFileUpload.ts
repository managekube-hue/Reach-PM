// hooks/useFileUpload.ts
// Spec Part 9.1 — C-13: profiles.default_workspace_id (not tenant_id)
import { useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

interface UploadedFile {
  url: string
  name: string
  type: string
  size: number
  thumbnail_url?: string
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const { user } = useReachStore()
  const supabase = createBrowserClient()

  const upload = useCallback(
    async (files: File[]): Promise<UploadedFile[]> => {
      if (!user?.id) return []
      setUploading(true)
      setProgress(0)

      // C-13: use default_workspace_id as the storage path prefix
      const workspaceId =
        user?.default_workspace_id ?? user?.id

      const results: UploadedFile[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        let thumbnail_url: string | undefined

        // Generate thumbnail for images without compression dependency
        if (file.type.startsWith('image/')) {
          try {
            const thumbPath = `${workspaceId}/thumbs/${Date.now()}-thumb-${file.name}`
            await supabase.storage
              .from('attachments')
              .upload(thumbPath, file, { contentType: file.type, upsert: false })
            const { data: thumbData } = await supabase.storage
              .from('attachments')
              .createSignedUrl(thumbPath, 86400)
            thumbnail_url = thumbData?.signedUrl
          } catch {
            // thumbnail generation is non-critical
          }
        }

        const path = `${workspaceId}/${Date.now()}-${file.name}`
        const { error } = await supabase.storage
          .from('attachments')
          .upload(path, file, { contentType: file.type, upsert: false })

        if (!error) {
          const { data } = await supabase.storage
            .from('attachments')
            .createSignedUrl(path, 86400)
          if (data?.signedUrl) {
            results.push({
              url: data.signedUrl,
              name: file.name,
              type: file.type,
              size: file.size,
              ...(thumbnail_url ? { thumbnail_url } : {}),
            })
          }
        }

        setProgress(Math.round(((i + 1) / files.length) * 100))
      }

      setUploading(false)
      return results
    },
    [user?.id, user?.default_workspace_id]
  )

  return { upload, uploading, progress }
}
