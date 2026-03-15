// hooks/useFileUpload.ts
// Spec Part 9.1 — C-13: profiles.default_workspace_id (not tenant_id)
import { useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import { useReachStore } from '@/store/useReachStore'

async function compressImage(
  file: File,
  maxDimension: number,
  maxBytes: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      let w = img.width
      let h = img.height
      if (w > maxDimension || h > maxDimension) {
        const ratio = Math.min(maxDimension / w, maxDimension / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const doBlob = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('toBlob failed')); return }
            if (blob.size > maxBytes && quality > 0.2) {
              doBlob(quality - 0.1)
            } else {
              resolve(new File([blob], file.name, { type: blob.type }))
            }
          },
          outputType,
          quality
        )
      }
      doBlob(0.85)
    }
    img.onerror = reject
    img.src = objectUrl
  })
}

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

        // Generate compressed thumbnail for images (200px, 50KB max)
        if (file.type.startsWith('image/')) {
          try {
            const thumbFile = await compressImage(file, 200, 50 * 1024)
            const thumbPath = `${workspaceId}/thumbs/${Date.now()}-thumb-${thumbFile.name}`
            await supabase.storage
              .from('attachments')
              .upload(thumbPath, thumbFile, { contentType: thumbFile.type, upsert: false })
            const { data: thumbData } = await supabase.storage
              .from('attachments')
              .createSignedUrl(thumbPath, 86400)
            thumbnail_url = thumbData?.signedUrl
          } catch {
            // thumbnail generation is non-critical
          }
        }

        // Compress main image (1920px, 2MB max); non-images uploaded as-is
        const uploadFile = file.type.startsWith('image/')
          ? await compressImage(file, 1920, 2 * 1024 * 1024).catch(() => file)
          : file

        const path = `${workspaceId}/${Date.now()}-${uploadFile.name}`
        const { error } = await supabase.storage
          .from('attachments')
          .upload(path, uploadFile, { contentType: uploadFile.type, upsert: false })

        if (!error) {
          const { data } = await supabase.storage
            .from('attachments')
            .createSignedUrl(path, 86400)
          if (data?.signedUrl) {
            results.push({
              url: data.signedUrl,
              name: file.name,
              type: uploadFile.type,
              size: uploadFile.size,
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
