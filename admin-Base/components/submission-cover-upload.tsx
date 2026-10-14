"use client"

import { useState } from "react"
import { Trash2, Upload } from "lucide-react"
import { uploadApi } from "@/lib/api"
import { resolveMediaUrl } from "@/lib/api-client"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

interface SubmissionCoverUploadProps {
  value: string
  onChange: (url: string) => void
}

export function SubmissionCoverUpload({ value, onChange }: SubmissionCoverUploadProps) {
  const [uploading, setUploading] = useState(false)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast.error("只支持 jpg/png/gif/webp 格式")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("图片大小不能超过 10MB")
      return
    }
    setUploading(true)
    try {
      const result = await uploadApi.image(file)
      onChange(result.url)
      toast.success("上传成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败")
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">封面图<span className="ml-0.5 text-[#f04438]">*</span></label>
      {value ? (
        <div className="relative w-fit">
          <img src={resolveMediaUrl(value)} alt="封面图" className="h-32 w-24 rounded-[6px] border border-[#e5e7eb] object-cover" />
          <button type="button" aria-label="移除封面" onClick={() => onChange("")} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#f04438] text-white shadow hover:bg-[#dc2626]"><Trash2 size={12} /></button>
        </div>
      ) : (
        <label className={cn("flex h-32 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[6px] border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] hover:border-[#38c08f] hover:bg-[#f0fdf4]", uploading && "pointer-events-none opacity-50")}>
          <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={uploading} onChange={handleFileChange} className="hidden" />
          {uploading ? <span className="text-[12px] text-[#9ca3af]">上传中...</span> : <><Upload size={20} className="text-[#9ca3af]" /><span className="text-[11px] text-[#9ca3af]">点击上传</span></>}
        </label>
      )}
    </div>
  )
}
