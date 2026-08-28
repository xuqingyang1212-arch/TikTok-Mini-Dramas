"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, ImageIcon, X, Upload, Trash2, Play, RefreshCw, Film } from "lucide-react"
import { cn } from "@/lib/utils"
import { ListPagination } from "@/components/list-pagination"
import { FilterInput, SelectFilter, DateRangePicker, FilterBar, FilterActions, type DateRangeValue, StatusBadge, RightDrawer, Popconfirm, FixedHeaderTable, thClass, FormSelect } from "@/components/shared"
import { dramaApi, uploadApi, episodeApi, type EpisodeItem } from "@/lib/api"
import { toast } from "@/lib/toast"
import { formatDateTime } from "@/lib/format"
import { useFilters } from "@/hooks/use-filters"
import { usePagination } from "@/hooks/use-pagination"

// ─────────────── Types ───────────────
interface DramaItem {
  id: string
  name: string
  coverUrl: string
  language: string
  episodeCount: number
  paywallEpisode: number
  status: string
  createdAt: string
}

interface FilterForm {
  dramaId: string
  name: string
  language: string
  status: string
  createdAtRange: DateRangeValue
}

interface DramaForm {
  name: string
  coverUrl: string
  language: string
  paywallEpisode: number
}

interface DramaFormErrors {
  name?: string
  language?: string
  paywallEpisode?: string
}

const defaultFilters: FilterForm = {
  dramaId: "",
  name: "",
  language: "",
  status: "",
  createdAtRange: [],
}

const languageOptions = [
  { label: "中文", value: "中文" },
  { label: "英文", value: "英文" },
]

const statusOptions = [
  { label: "上架", value: "上架" },
  { label: "下架", value: "下架" },
]

const statusConfig = {
  上架: { bg: "bg-[#d1fae5]", text: "text-[#059669]" },
  下架: { bg: "bg-[#fee2e2]", text: "text-[#dc2626]" },
}

// ─────────────── FormInput ───────────────
function FormInput({
  label, placeholder, value, onChange, error, required, type = "text",
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  error?: string
  required?: boolean
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}{required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-[34px] w-full rounded-[6px] border px-3 text-[13px] outline-none transition-colors",
          "bg-white text-[#374151] placeholder-[#9ca3af] focus:border-[#38c08f]",
          error ? "border-[#f04438]" : "border-[#d1d5db]"
        )}
      />
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}

// ─────────────── FormNumberInput ───────────────
function FormNumberInput({
  label, placeholder, value, onChange, error, required, min,
}: {
  label: string
  placeholder: string
  value: number
  onChange: (v: number) => void
  error?: string
  required?: boolean
  min?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">
        {label}{required && <span className="ml-0.5 text-[#f04438]">*</span>}
      </label>
      <input
        type="number"
        placeholder={placeholder}
        value={value > 0 ? value : ""}
        min={min}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className={cn(
          "h-[34px] w-full rounded-[6px] border px-3 text-[13px] outline-none transition-colors",
          "bg-white text-[#374151] placeholder-[#9ca3af] focus:border-[#38c08f]",
          error ? "border-[#f04438]" : "border-[#d1d5db]"
        )}
      />
      {error && <p className="text-[12px] text-[#f04438]">{error}</p>}
    </div>
  )
}

// ─────────────── ImageUpload ───────────────
function ImageUpload({
  label, value, onChange,
}: {
  label: string
  value: string
  onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
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
    } catch (err: any) {
      toast.error(err.message || "上传失败")
    } finally {
      setUploading(false)
    }
    e.target.value = ""
  }

  function handleRemove() {
    onChange("")
  }

  const imageUrl = value && !value.startsWith("http")
    ? `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:8080${value}`
    : value

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-[#374151]">{label}</label>
      {value ? (
        <div className="relative inline-block w-fit">
          <img
            src={imageUrl}
            alt="封面图"
            className="h-24 w-24 rounded-[6px] border border-[#e5e7eb] object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#f04438] text-white shadow hover:bg-[#dc2626]"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ) : (
        <label
          className={cn(
            "flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[6px] border-2 border-dashed border-[#d1d5db] bg-[#f9fafb] transition-colors hover:border-[#38c08f] hover:bg-[#f0fdf4]",
            uploading && "pointer-events-none opacity-50"
          )}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <span className="text-[12px] text-[#9ca3af]">上传中...</span>
          ) : (
            <>
              <Upload size={20} className="text-[#9ca3af]" />
              <span className="text-[11px] text-[#9ca3af]">点击上传</span>
            </>
          )}
        </label>
      )}
    </div>
  )
}

// ─────────────── DramaDrawer ───────────────
function DramaDrawer({
  mode, drama, onClose, onSubmit,
}: {
  mode: "add" | "edit"
  drama?: DramaItem
  onClose: () => void
  onSubmit: (form: DramaForm) => Promise<void>
}) {
  const isEdit = mode === "edit"
  const [form, setForm] = useState<DramaForm>(() => (
    isEdit && drama
      ? { name: drama.name, coverUrl: drama.coverUrl, language: drama.language, paywallEpisode: drama.paywallEpisode || 2 }
      : { name: "", coverUrl: "", language: "", paywallEpisode: 0 }
  ))
  const [errors, setErrors] = useState<DramaFormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function setField<K extends keyof DramaForm>(key: K, val: DramaForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: DramaFormErrors = {}
    if (!form.name.trim()) errs.name = "请输入剧集名称"
    if (!form.language) errs.language = "请选择语种"
   if (form.paywallEpisode < 1) errs.paywallEpisode = "付费卡点必须大于0"
    // 编辑时，如果有集数，卡点不能超过总集数（不管上架还是下架）
    if (isEdit && drama && drama.episodeCount > 0 && form.paywallEpisode > drama.episodeCount) {
      errs.paywallEpisode = `付费卡点不能超过总集数(${drama.episodeCount})`
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      await onSubmit(form)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RightDrawer width={480} zIndex={50} overlayOpacity={0.2} onClose={onClose}>
      <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
        <span className="text-[15px] font-semibold text-[#111827]">{isEdit ? "编辑剧集" : "创建剧集"}</span>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-5">
          <FormInput
            label="剧集名称"
            placeholder="请输入剧集名称"
            value={form.name}
            onChange={(v) => setField("name", v)}
            error={errors.name}
            required
          />
          <ImageUpload
            label="封面图"
            value={form.coverUrl}
            onChange={(v) => setField("coverUrl", v)}
          />
          <FormSelect
            label="语种"
            value={form.language}
            onChange={(v) => setField("language", v)}
            options={languageOptions}
            error={errors.language}
            required
          />
          <FormNumberInput
            label="付费卡点"
            placeholder="请输入付费卡点集数"
            value={form.paywallEpisode}
            onChange={(v) => setField("paywallEpisode", v)}
            error={errors.paywallEpisode}
            required
            min={1}
          />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#e5e7eb] px-6 py-4">
        <button
          onClick={onClose}
          className="h-[34px] rounded-[6px] border border-[#d1d5db] bg-white px-4 text-[13px] text-[#374151] transition-colors hover:bg-[#f5f6f7]"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="h-[34px] rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a] disabled:opacity-50"
        >
          {submitting ? "提交中..." : "确定"}
        </button>
      </div>
    </RightDrawer>
  )
}

// ─────────────── Upload Progress Types ───────────────
interface EpisodeUploadStatus {
  episodeNo: number
  fileName: string
  percent: number // 0-100
  status: "pending" | "uploading" | "done" | "failed"
  error?: string
}

// ─────────────── DetailDrawer ───────────────
const EPISODES_PER_PAGE = 50

function DetailDrawer({
  drama,
  episodes,
  loading,
  onClose,
  onBatchUpload,
  onReupload,
  onDeleteEpisode,
  uploadingEpisodes,
}: {
  drama: DramaItem
  episodes: EpisodeItem[]
  loading: boolean
  onClose: () => void
  onBatchUpload: (files: FileList) => void
  onReupload: (episodeId: string, file: File) => void
  onDeleteEpisode: (episodeId: string) => void
  uploadingEpisodes: EpisodeUploadStatus[]
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [selectedEpisode, setSelectedEpisode] = useState<EpisodeItem | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (episodes.length > 0 && !selectedEpisode) {
      setSelectedEpisode(episodes[0])
    }
  }, [episodes])

  function getVideoUrl(url: string) {
    if (!url) return ""
    if (url.startsWith("http")) return url
    return `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:8080${url}`
  }

  function handleBatchUploadClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) {
      onBatchUpload(files)
    }
    e.target.value = ""
  }

  function handleVideoEnded() {
    if (!selectedEpisode) return
    const currentIndex = episodes.findIndex(ep => ep.id === selectedEpisode.id)
    if (currentIndex < episodes.length - 1) {
      const nextEp = episodes[currentIndex + 1]
      setSelectedEpisode(nextEp)
      const nextTabIndex = Math.floor((nextEp.episodeNo - 1) / EPISODES_PER_PAGE)
      if (nextTabIndex !== activeTab) {
        setActiveTab(nextTabIndex)
      }
    }
  }

  function handleSelectEpisode(ep: EpisodeItem) {
    setSelectedEpisode(ep)
  }

  const totalEpisodes = episodes.length
  const totalTabs = Math.ceil(totalEpisodes / EPISODES_PER_PAGE)
  const tabs = Array.from({ length: totalTabs }, (_, i) => {
    const start = i * EPISODES_PER_PAGE + 1
    const end = Math.min((i + 1) * EPISODES_PER_PAGE, totalEpisodes)
    return { label: `${start}-${end}`, start, end }
  })

  const currentTabEpisodes = episodes.filter(
    (ep) => ep.episodeNo >= (tabs[activeTab]?.start || 1) && ep.episodeNo <= (tabs[activeTab]?.end || 50)
  )

  const isUploading = uploadingEpisodes.length > 0

  // 判断是否付费集
  function isPaidEpisode(episodeNo: number): boolean {
    return episodeNo >= drama.paywallEpisode
  }

  return (
    <RightDrawer width={960} zIndex={50} overlayOpacity={0.2} onClose={onClose}>
      <div className="relative flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold text-[#111827]">{drama.name}</span>
          <span className="text-[13px] text-[#9ca3af]">共 {drama.episodeCount} 集</span>
          <span className="text-[13px] text-[#f97316]">卡点：第{drama.paywallEpisode}集起付费</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBatchUploadClick}
            disabled={isUploading}
            className={`flex h-[32px] items-center gap-1.5 rounded-[6px] px-4 text-[13px] font-medium text-white transition-colors ${isUploading ? "cursor-not-allowed bg-[#9ca3af]" : "bg-[#38c08f] hover:bg-[#2da87a]"}`}
          >
            <Upload size={14} />上传剧集
          </button>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[#9ca3af] transition-colors hover:bg-[#f3f4f6] hover:text-[#374151]">
            <X size={18} />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/mov,video/webm,video/avi,video/x-matroska"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Upload Progress: floating panel at top-right */}
      {isUploading && (
        <div className="absolute top-16 right-6 z-10 w-[320px] rounded-lg border border-[#e5e7eb] bg-white shadow-lg">
          <div className="border-b border-[#e5e7eb] px-4 py-2.5">
            <span className="text-[13px] font-medium text-[#111827]">上传进度</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto px-4 py-3">
            <div className="flex flex-col gap-2.5">
              {uploadingEpisodes.map((ep) => (
                <div key={ep.episodeNo} className="flex items-center gap-3">
                  <span className="w-[50px] shrink-0 text-[12px] text-[#374151] font-medium">第{ep.episodeNo}集</span>
                  <div className="flex-1 h-[6px] overflow-hidden rounded-full bg-[#e5e7eb]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-200",
                        ep.status === "failed" ? "bg-[#ef4444]" : ep.status === "done" ? "bg-[#38c08f]" : "bg-[#38c08f]"
                      )}
                      style={{ width: `${ep.percent}%` }}
                    />
                  </div>
                  <span className="w-[50px] shrink-0 text-right text-[12px] text-[#6b7280]">
                    {ep.status === "done" ? "已完成" : ep.status === "failed" ? "失败" : ep.status === "pending" ? "等待中" : `${ep.percent}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Player: height fills container, width = height * 9/16, so 9:16 videos fill perfectly */}
        {!loading && episodes.length > 0 && selectedEpisode && (
          <div 
            className="shrink-0 bg-[#0a0a0f] relative h-full"
            style={{ aspectRatio: "9/16" }}
          >
            <video
              ref={videoRef}
              key={selectedEpisode.id}
              src={getVideoUrl(selectedEpisode.videoUrl)}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "contain" }}
              controls
              autoPlay
              onEnded={handleVideoEnded}
            />
          </div>
        )}

        <div className={`flex flex-col bg-white ${episodes.length > 0 && selectedEpisode ? "min-w-[320px] flex-1 border-l border-[#e5e7eb]" : "flex-1"}`}>
          {tabs.length > 1 && (
            <div className="flex shrink-0 items-center gap-1 border-b border-[#e5e7eb] px-4 py-3">
              {tabs.map((tab, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`rounded-[6px] px-4 py-1.5 text-[13px] font-medium transition-colors ${
                    activeTab === idx
                      ? "bg-[#fff7ed] text-[#f97316]"
                      : "text-[#6b7280] hover:bg-[#f3f4f6]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center text-[13px] text-[#9ca3af]">加载中...</div>
            ) : currentTabEpisodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-20"><Film size={48} className="text-[#d1d5db]" /><p className="mt-4 text-[14px] text-[#6b7280]">暂无剧集</p><p className="mt-1 text-[13px] text-[#9ca3af]">点击上方按钮上传</p></div>
            ) : (
              <div className="flex flex-col">
                {currentTabEpisodes.map((ep) => {
                  const isSelected = selectedEpisode?.id === ep.id
                  const isPaid = isPaidEpisode(ep.episodeNo)
                  return (
                    <div
                      key={ep.id}
                      onClick={() => handleSelectEpisode(ep)}
                      className={`group flex cursor-pointer items-center justify-between border-b border-[#f3f4f6] px-4 py-3 transition-colors ${
                        isSelected ? "bg-[#fff7ed]" : "hover:bg-[#f9fafb]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[11px] font-medium",
                          isPaid 
                            ? "bg-[#fef3c7] text-[#d97706]" 
                            : "bg-[#d1fae5] text-[#059669]"
                        )}>
                          {isPaid ? "付费" : "免费"}
                        </span>
                        <span className={`text-[14px] ${isSelected ? "font-medium text-[#f97316]" : "text-[#374151]"}`}>
                          第{ep.episodeNo}集
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 transition-all group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                        <label
                          className="flex h-[26px] cursor-pointer items-center gap-1 rounded-[5px] border border-[#e5e7eb] bg-white px-2 text-[12px] text-[#6b7280] hover:border-[#d1d5db] hover:bg-[#f5f6f7]"
                        >
                          <RefreshCw size={11} />
                          <span>重传</span>
                          <input
                            type="file"
                            accept="video/mp4,video/mov,video/webm,video/avi,video/x-matroska"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) onReupload(ep.id, file)
                              e.target.value = ""
                            }}
                            className="hidden"
                          />
                        </label>
                        {ep.episodeNo === Math.max(...episodes.map(e => e.episodeNo)) && (
                          <Popconfirm
                            title="确定删除最后一集？"
                            description="此操作不可恢复"
                            onConfirm={() => onDeleteEpisode(ep.id)}
                          >
                            <button
                              className="flex h-[26px] items-center gap-1 rounded-[5px] border border-[#fecaca] bg-white px-2 text-[12px] text-[#ef4444] hover:border-[#ef4444] hover:bg-[#fef2f2]"
                            >
                              <X size={11} />
                              <span>删除</span>
                            </button>
                          </Popconfirm>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </RightDrawer>
  )
}

// ─────────────── Main Component ───────────────
export default function DramaManagement() {
  const { draft: draftFilters, active: activeFilters, update: updateDraft, apply: applyFilters, reset: resetFilters } = useFilters(defaultFilters)
  const { page: currentPage, pageSize, resetPage, paginationProps } = usePagination()

  const [data, setData] = useState<DramaItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  // 固定表头：横向滚动同步（表头随内容一起横向平移，且帧级对齐）

  // Drawer state
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | null>(null)
  const [editingDrama, setEditingDrama] = useState<DramaItem | undefined>()

  // Image preview state
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Detail drawer state
  const [detailDrama, setDetailDrama] = useState<DramaItem | null>(null)
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)

  // Upload progress state - per episode
  const [uploadingEpisodes, setUploadingEpisodes] = useState<EpisodeUploadStatus[]>([])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await dramaApi.list<DramaItem>({
        page: currentPage,
        pageSize,
        dramaId: activeFilters.dramaId.trim() || undefined,
        name: activeFilters.name.trim() || undefined,
        language: activeFilters.language || undefined,
        status: activeFilters.status || undefined,
        createdAtFrom: activeFilters.createdAtRange[0] || undefined,
        createdAtTo: activeFilters.createdAtRange[1] || undefined,
      })
      setData(res.list || [])
      setTotal(res.total ?? 0)
    } catch {
      setData([])
      setTotal(0)
      toast.error("加载失败")
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, activeFilters])

  useEffect(() => { void fetchList() }, [fetchList])

  function handleQuery() { applyFilters(); resetPage() }
  function handleReset() { resetFilters(); resetPage() }

  async function handleToggleStatus(row: DramaItem) {
    if (row.status === "下架" && row.episodeCount === 0) {
      toast.error("总集数为0，不可上架")
      return
    }
    if (row.status === "下架" && row.paywallEpisode > row.episodeCount) {
      toast.error(`付费卡点(${row.paywallEpisode})超过总集数(${row.episodeCount})，不可上架`)
      return
    }
    try {
      await dramaApi.toggleStatus(row.id)
      toast.success(row.status === "上架" ? "已下架" : "已上架")
      fetchList()
    } catch (err: any) {
      toast.error(err.message || "操作失败")
    }
  }

  function handleCreate() {
    setEditingDrama(undefined)
    setDrawerMode("add")
  }

  function handleEdit(row: DramaItem) {
    setEditingDrama(row)
    setDrawerMode("edit")
  }

  function handleViewDetail(row: DramaItem) {
    setDetailDrama(row)
    fetchEpisodes(row.id)
  }

  async function fetchEpisodes(dramaId: string) {
    setLoadingEpisodes(true)
    try {
      const items = await episodeApi.listByDrama(dramaId)
      setEpisodes(items || [])
    } catch {
      setEpisodes([])
      toast.error("加载剧集列表失败")
    } finally {
      setLoadingEpisodes(false)
    }
  }

  function handleCloseDetail() {
    setDetailDrama(null)
    setEpisodes([])
  }

  // Parse episode number from filename
  function parseEpisodeNo(filename: string): number | null {
    const patterns = [
      /第(\d+)集/,
      /[Ee]p?(\d+)/,
      /[_\-\s](\d+)[_\-\s.]/,
      /^(\d+)[_\-\s.]/,
      /(\d+)\.(?:mp4|mov|webm|avi|mkv)$/i,
    ]
    for (const pattern of patterns) {
      const match = filename.match(pattern)
      if (match) return parseInt(match[1], 10)
    }
    return null
  }

  async function handleBatchUpload(files: FileList) {
    if (!detailDrama) return

    // Parse and sort files by episode number
    const fileList = Array.from(files)
    const parsed: { file: File; episodeNo: number }[] = []

    for (const file of fileList) {
      const no = parseEpisodeNo(file.name)
      if (no === null) {
        toast.error(`无法识别 "${file.name}" 的集数，请确保文件名包含数字`)
        return
      }
      parsed.push({ file, episodeNo: no })
    }

    // Sort by episode number
    parsed.sort((a, b) => a.episodeNo - b.episodeNo)

    // Validate continuity
    const currentMax = episodes.length > 0 ? Math.max(...episodes.map(e => e.episodeNo)) : 0
    const expectedStart = currentMax + 1

    for (let i = 0; i < parsed.length; i++) {
      const expectedNo = expectedStart + i
      if (parsed[i].episodeNo !== expectedNo) {
        toast.error(`集数不连续：期望第 ${expectedNo} 集，但文件 "${parsed[i].file.name}" 是第 ${parsed[i].episodeNo} 集`)
        return
      }
    }

    // Initialize per-episode upload status
    const initialStatus: EpisodeUploadStatus[] = parsed.map((item) => ({
      episodeNo: item.episodeNo,
      fileName: item.file.name,
      percent: 0,
      status: "pending",
    }))
    setUploadingEpisodes(initialStatus)

    try {
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i]
        const UPLOAD_DURATION = 3000 // 3秒

        // Mark current as uploading
        setUploadingEpisodes((prev) =>
          prev.map((ep, idx) => idx === i ? { ...ep, status: "uploading", percent: 0 } : ep)
        )

        // Start simulated progress animation (0% to 90% over 2.7s)
        const startTime = Date.now()
        let cancelled = false
        const progressInterval = setInterval(() => {
          if (cancelled) return
          const elapsed = Date.now() - startTime
          const progress = Math.min(90, Math.floor((elapsed / UPLOAD_DURATION) * 100))
          setUploadingEpisodes((prev) =>
            prev.map((ep, idx) => idx === i ? { ...ep, percent: progress } : ep)
          )
        }, 50)

        let result: { url: string; size: number }
        try {
          // Start real upload
          const uploadPromise = uploadApi.video(item.file)
          
          // Wait for both upload completion and minimum time
          const [uploadResult] = await Promise.all([
            uploadPromise,
            new Promise<void>(resolve => setTimeout(resolve, UPLOAD_DURATION))
          ])
          result = uploadResult
        } catch (err: any) {
          cancelled = true
          clearInterval(progressInterval)
          // Mark as failed and stop
          setUploadingEpisodes((prev) =>
            prev.map((ep, idx) => idx === i ? { ...ep, status: "failed", error: err.message } : ep)
          )
          toast.error(`第${item.episodeNo}集上传失败：${err.message || "网络错误"}`)
          // Don't continue uploading subsequent episodes
          setTimeout(() => setUploadingEpisodes([]), 3000)
          return
        }

        cancelled = true
        clearInterval(progressInterval)

        // Upload done, create episode on server
        try {
          await episodeApi.batchCreate(detailDrama.id, [{
            episodeNo: item.episodeNo,
            videoUrl: result.url,
            fileSize: result.size,
          }])
        } catch (err: any) {
          setUploadingEpisodes((prev) =>
            prev.map((ep, idx) => idx === i ? { ...ep, status: "failed", error: err.message } : ep)
          )
          toast.error(`第${item.episodeNo}集创建失败：${err.message}`)
          setTimeout(() => setUploadingEpisodes([]), 3000)
          return
        }

        // Mark as done
        setUploadingEpisodes((prev) =>
          prev.map((ep, idx) => idx === i ? { ...ep, status: "done", percent: 100 } : ep)
        )
      }

      toast.success(`成功上传 ${parsed.length} 集`)
      fetchEpisodes(detailDrama.id)
      fetchList()
    } finally {
      setTimeout(() => setUploadingEpisodes([]), 2000)
    }
  }

  async function handleReupload(episodeId: string, file: File) {
    if (!detailDrama) return

    try {
      toast.info("正在上传...")
      const result = await uploadApi.video(file)
      await episodeApi.update(detailDrama.id, episodeId, {
        videoUrl: result.url,
        fileSize: result.size,
      })
      toast.success("重新上传成功")
      fetchEpisodes(detailDrama.id)
    } catch (err: any) {
      toast.error(err.message || "上传失败")
    }
  }

  async function handleDeleteEpisode(episodeId: string) {
    if (!detailDrama) return
    try {
      await episodeApi.delete(detailDrama.id, episodeId)
      toast.success("删除成功")
      fetchEpisodes(detailDrama.id)
      fetchList()
    } catch (err: any) {
      toast.error(err.message || "删除失败")
    }
  }

  function handleCloseDrawer() {
    setDrawerMode(null)
    setEditingDrama(undefined)
  }

  async function handleSubmitDrama(form: DramaForm) {
    try {
      if (drawerMode === "add") {
        await dramaApi.create(form)
        toast.success("创建成功")
      } else if (drawerMode === "edit" && editingDrama) {
        await dramaApi.update(editingDrama.id, form)
        toast.success("更新成功")
      }
      handleCloseDrawer()
      fetchList()
    } catch (err: any) {
      toast.error(err.message || "操作失败")
    }
  }

  // Build image URL for display
  function getImageUrl(url: string) {
    if (!url) return ""
    if (url.startsWith("http")) return url
    return `http://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:8080${url}`
  }

  // 判断上架按钮是否禁用
  function isPublishDisabled(row: DramaItem): boolean {
    if (row.status === "上架") return false // 下架操作总是可用
    if (row.episodeCount === 0) return true
    if (row.paywallEpisode > row.episodeCount) return true
    return false
  }

  // 获取上架按钮禁用原因
  function getPublishDisabledReason(row: DramaItem): string {
    if (row.episodeCount === 0) return "总集数为0"
    if (row.paywallEpisode > row.episodeCount) return `卡点(${row.paywallEpisode})>总集数(${row.episodeCount})`
    return ""
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">
      {/* 筛选区 */}
      <FilterBar
        actions={<FilterActions onQuery={handleQuery} onReset={handleReset} />}
      >
        <FilterInput block label="剧集ID" placeholder="请输入" value={draftFilters.dramaId} onChange={(v) => updateDraft("dramaId", v)} />
        <FilterInput block label="剧集名称" placeholder="请输入" value={draftFilters.name} onChange={(v) => updateDraft("name", v)} />
        <SelectFilter block label="语种" value={draftFilters.language} onChange={(v) => updateDraft("language", v)} options={languageOptions} placeholder="全部" />
        <SelectFilter block label="状态" value={draftFilters.status} onChange={(v) => updateDraft("status", v)} options={statusOptions} placeholder="全部" />
        <DateRangePicker block label="创建时间" value={draftFilters.createdAtRange} onChange={(v) => updateDraft("createdAtRange", v)} />
      </FilterBar>

      {/* 操作栏 */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[#e5e7eb] px-5 py-3">
        <button
          onClick={handleCreate}
          className="flex h-[30px] items-center gap-1.5 rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#2da87a]"
        >
          <Plus size={14} />创建剧集
        </button>
      </div>

      {/* 表格区：统一固定表头组件（固定表头 + 独立滚动 + 防触控板回弹） */}
      <FixedHeaderTable
        autoWidth
        minWidth={900}
        columns={new Array(9).fill("")}
        loading={loading && data.length === 0}
        empty={data.length === 0}
        header={[
          "剧集ID", "剧集名称", "封面图", "语种", "总集数", "卡点集数", "状态", "创建时间", "操作",
        ].map((label) => (
          <th key={label} className={thClass}>{label}</th>
        ))}
      >
            {data.map((row, i) => (
                <tr key={row.id}
                  className={cn("transition-colors hover:bg-[#f9fafb]", i < data.length - 1 && "border-b border-[#f3f4f6]")}>
                  <td className="px-4 py-3 text-[12.5px] font-mono text-[#4b5563] whitespace-nowrap">{row.id}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#111827] whitespace-nowrap">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.coverUrl ? (
                      <img src={getImageUrl(row.coverUrl)} alt={row.name} className="h-10 w-10 cursor-pointer rounded object-cover transition-opacity hover:opacity-80" onClick={() => setPreviewImage(getImageUrl(row.coverUrl))} />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-[#f3f4f6]">
                        <ImageIcon size={16} className="text-[#9ca3af]" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">{row.language}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">{row.episodeCount}</td>
                  <td className="px-4 py-3 text-[12.5px] text-[#f97316] whitespace-nowrap">{row.paywallEpisode}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} config={statusConfig} />
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-[#6b7280] whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(row)}
                        className="rounded border border-[#38c08f] px-2.5 py-1 text-[12px] text-[#38c08f] transition-colors hover:bg-[#f0fdf4]"
                      >
                        编辑
                      </button>
                      {row.status === "上架" ? (
                        <Popconfirm
                          title="确认下架该剧集？"
                          description="下架后小程序端将无法看到该剧集"
                          onConfirm={() => handleToggleStatus(row)}
                        >
                          <button
                            className="rounded border border-[#f87171] px-2.5 py-1 text-[12px] text-[#f87171] transition-colors hover:bg-[#fef2f2]"
                          >
                            下架
                          </button>
                        </Popconfirm>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(row)}
                          className="rounded border border-[#38c08f] px-2.5 py-1 text-[12px] text-[#38c08f] transition-colors hover:bg-[#f0fdf4]"
                        >
                          上架
                        </button>
                      )}
                      <button
                        onClick={() => handleViewDetail(row)}
                        className="rounded border border-[#6b7280] px-2.5 py-1 text-[12px] text-[#6b7280] transition-colors hover:bg-[#f9fafb]"
                      >
                        查看详情
                      </button>
                    </div>
                  </td>
                </tr>
            ))}
      </FixedHeaderTable>

      {/* 分页区 */}
      <div className="shrink-0 border-t border-[#e5e7eb]">
        <ListPagination total={total} {...paginationProps} />
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-h-[80vh] max-w-[80vw]">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md text-[#374151] hover:bg-[#f3f4f6] transition-colors"
            >
              <X size={14} />
            </button>
            <img
              src={previewImage}
              alt="预览"
              className="max-h-[80vh] max-w-[80vw] rounded-lg object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {drawerMode && (
        <DramaDrawer
          mode={drawerMode}
          drama={editingDrama}
          onClose={handleCloseDrawer}
          onSubmit={handleSubmitDrama}
        />
      )}

      {detailDrama && (
        <DetailDrawer
          drama={detailDrama}
          episodes={episodes}
          loading={loadingEpisodes}
          onClose={handleCloseDetail}
          onBatchUpload={handleBatchUpload}
          onReupload={handleReupload}
          onDeleteEpisode={handleDeleteEpisode}
          uploadingEpisodes={uploadingEpisodes}
        />
      )}
    </div>
  )
}
