"use client"

import { useCallback, useState } from "react"
import { episodeApi, uploadApi, type EpisodeItem } from "@/lib/api"
import { toast } from "@/lib/toast"

export interface EpisodeUploadStatus {
  episodeNo: number
  fileName: string
  percent: number
  status: "pending" | "uploading" | "done" | "failed"
  error?: string
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function parseEpisodeNo(filename: string): number | null {
  const patterns = [/第(\d+)集/, /[Ee]p?(\d+)/, /[_\-\s](\d+)[_\-\s.]/, /^(\d+)[_\-\s.]/, /(\d+)\.(?:mp4|mov|webm|avi|mkv)$/i]
  for (const pattern of patterns) {
    const match = filename.match(pattern)
    if (match) return parseInt(match[1], 10)
  }
  return null
}

export function useEpisodeOperations({
  dramaId,
  episodes,
  canUpload,
  canDelete,
  reloadEpisodes,
  reloadDramas,
}: {
  dramaId?: string
  episodes: EpisodeItem[]
  canUpload: boolean
  canDelete: boolean
  reloadEpisodes: (dramaId: string) => void | Promise<void>
  reloadDramas: () => void | Promise<void>
}) {
  const [uploadingEpisodes, setUploadingEpisodes] = useState<EpisodeUploadStatus[]>([])

  const batchUpload = useCallback(async (files: FileList) => {
    if (!dramaId) return
    if (!canUpload) {
      toast.error("暂无上传权限")
      return
    }
    const parsed: { file: File; episodeNo: number }[] = []
    for (const file of Array.from(files)) {
      const episodeNo = parseEpisodeNo(file.name)
      if (episodeNo === null) {
        toast.error(`无法识别 "${file.name}" 的集数，请确保文件名包含数字`)
        return
      }
      parsed.push({ file, episodeNo })
    }
    parsed.sort((a, b) => a.episodeNo - b.episodeNo)
    const expectedStart = (episodes.length ? Math.max(...episodes.map((episode) => episode.episodeNo)) : 0) + 1
    for (let index = 0; index < parsed.length; index++) {
      const expected = expectedStart + index
      if (parsed[index].episodeNo !== expected) {
        toast.error(`集数不连续：期望第 ${expected} 集，但文件 "${parsed[index].file.name}" 是第 ${parsed[index].episodeNo} 集`)
        return
      }
    }
    setUploadingEpisodes(parsed.map(({ file, episodeNo }) => ({ episodeNo, fileName: file.name, percent: 0, status: "pending" })))
    try {
      for (let index = 0; index < parsed.length; index++) {
        const item = parsed[index]
        const uploadDuration = 3000
        setUploadingEpisodes((previous) => previous.map((episode, itemIndex) => itemIndex === index ? { ...episode, status: "uploading", percent: 0 } : episode))
        const startedAt = Date.now()
        let cancelled = false
        const progressInterval = setInterval(() => {
          if (cancelled) return
          const percent = Math.min(90, Math.floor(((Date.now() - startedAt) / uploadDuration) * 100))
          setUploadingEpisodes((previous) => previous.map((episode, itemIndex) => itemIndex === index ? { ...episode, percent } : episode))
        }, 50)
        let upload: { url: string; size: number }
        try {
          ;[upload] = await Promise.all([uploadApi.video(item.file), new Promise<void>((resolve) => setTimeout(resolve, uploadDuration))])
        } catch (error) {
          cancelled = true
          clearInterval(progressInterval)
          const message = errorMessage(error, "网络错误")
          setUploadingEpisodes((previous) => previous.map((episode, itemIndex) => itemIndex === index ? { ...episode, status: "failed", error: message } : episode))
          toast.error(`第${item.episodeNo}集上传失败：${message}`)
          setTimeout(() => setUploadingEpisodes([]), 3000)
          return
        }
        cancelled = true
        clearInterval(progressInterval)
        try {
          await episodeApi.batchCreate(dramaId, [{ episodeNo: item.episodeNo, videoUrl: upload.url, fileSize: upload.size }])
        } catch (error) {
          const message = errorMessage(error, "创建失败")
          setUploadingEpisodes((previous) => previous.map((episode, itemIndex) => itemIndex === index ? { ...episode, status: "failed", error: message } : episode))
          toast.error(`第${item.episodeNo}集创建失败：${message}`)
          setTimeout(() => setUploadingEpisodes([]), 3000)
          return
        }
        setUploadingEpisodes((previous) => previous.map((episode, itemIndex) => itemIndex === index ? { ...episode, status: "done", percent: 100 } : episode))
      }
      toast.success(`成功上传 ${parsed.length} 集`)
      await reloadEpisodes(dramaId)
      await reloadDramas()
    } finally {
      setTimeout(() => setUploadingEpisodes([]), 2000)
    }
  }, [canUpload, dramaId, episodes, reloadDramas, reloadEpisodes])

  const reupload = useCallback(async (episodeId: string, file: File) => {
    if (!dramaId) return
    if (!canUpload) return void toast.error("暂无上传权限")
    try {
      toast.info("正在上传...")
      const result = await uploadApi.video(file)
      await episodeApi.update(dramaId, episodeId, { videoUrl: result.url, fileSize: result.size })
      toast.success("重新上传成功")
      await reloadEpisodes(dramaId)
    } catch (error) {
      toast.error(errorMessage(error, "上传失败"))
    }
  }, [canUpload, dramaId, reloadEpisodes])

  const deleteEpisode = useCallback(async (episodeId: string) => {
    if (!dramaId) return
    if (!canDelete) return void toast.error("暂无删除权限")
    try {
      await episodeApi.delete(dramaId, episodeId)
      toast.success("删除成功")
      await reloadEpisodes(dramaId)
      await reloadDramas()
    } catch (error) {
      toast.error(errorMessage(error, "删除失败"))
    }
  }, [canDelete, dramaId, reloadDramas, reloadEpisodes])

  return { uploadingEpisodes, batchUpload, reupload, deleteEpisode } as const
}
