"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { dramaSubmissionApi, episodeApi, type DramaSubmissionListItem, type EligibleDramaItem, type EpisodeItem } from "@/lib/api"
import { SubmissionCoverUpload } from "@/components/submission-cover-upload"
import { SubmissionDetailDrawers } from "@/components/submission-detail-drawers"
import { SubmissionAuthorizationDrawer } from "@/components/submission-authorization-drawer"
import { formatDateTime } from "@/lib/format"
import { toast } from "@/lib/toast"
import { usePerm } from "@/components/admin-layout"
import { PromotionOptionSelect } from "@/components/promotion-option-select"
import { useFilters } from "@/hooks/use-filters"
import { usePagedQuery } from "@/hooks/use-paged-query"
import { usePagination } from "@/hooks/use-pagination"
import { ListPagination } from "@/components/list-pagination"
import { ActionButton, FilterActions, FilterBar, FilterInput, FixedHeaderTable, FormInput, FormSelect, MultiSelectFilter, Popconfirm, RightDrawer, SelectFilter, StatusBadge, thClass } from "@/components/shared"

interface FilterForm { albumId: string; submittedName: string; dramaId: string; reviewStatus: string; publishStatus: string }
interface SubmissionForm { dramaId: string; submittedName: string; coverUrl: string; language: string; year: string; description: string; dramaType: string; tagList: string[] }
type ResourceUploadStatus = "not_uploaded" | "uploading" | "uploaded" | "failed"
type EpisodeResourcePreview = EpisodeItem & { uploadStatus: ResourceUploadStatus }

const defaultFilters: FilterForm = { albumId: "", submittedName: "", dramaId: "", reviewStatus: "", publishStatus: "" }
const emptyForm = (): SubmissionForm => ({ dramaId: "", submittedName: "", coverUrl: "", language: "", year: String(new Date().getFullYear()), description: "", dramaType: "", tagList: [] })
const publishStatuses = [{ label: "上架", value: "1" }, { label: "下架", value: "2" }]
const reviewStatuses = [{ label: "未送审", value: "0" }, { label: "审核中", value: "1" }, { label: "通过", value: "2" }, { label: "驳回", value: "3" }, { label: "已撤回", value: "4" }]
const dramaTypes = [{ label: "AIGC", value: "1" }, { label: "漫剧", value: "2" }, { label: "真人配音", value: "3" }, { label: "真人本地化", value: "4" }]
const tagLabels = ["医神", "赘婿", "鉴宝", "战神", "娱乐明星", "神医", "重生", "职场", "逆袭", "复仇", "青春", "官场", "家庭情感", "乡村", "正能量", "成长", "伦理", "都市情感", "社会话题", "灵异", "悬疑推理", "虐恋", "甜宠", "军婚", "年代", "萌宝", "腹黑", "总裁", "宫斗宅斗", "穿越", "种田经商"]
const tagLabelsAfterGap = ["民俗", "古装", "穿越战争", "现代军事", "奇幻", "科幻", "玄幻", "热血", "历史", "搞笑", "仙侠", "武侠", "二次元", "其他"]
const tagOptions = [...tagLabels.map((label, index) => ({ label, value: String(index + 1) })), ...tagLabelsAfterGap.map((label, index) => ({ label, value: String(index + 33) }))]
const publishStatusLabels: Record<number, string> = { 1: "上架", 2: "下架" }
const reviewStatusLabels: Record<number, string> = { 0: "未送审", 1: "审核中", 2: "通过", 3: "驳回", 4: "已撤回" }
const reviewBadgeConfig = { "未送审": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }, "审核中": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" }, "通过": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" }, "驳回": { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" }, "已撤回": { bg: "bg-[#eef2ff]", text: "text-[#4f46e5]" } }
const resourceUploadLabels: Record<ResourceUploadStatus, string> = { not_uploaded: "未上传", uploading: "上传中", uploaded: "已上传", failed: "上传失败" }
const resourceUploadConfig = { "未上传": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }, "上传中": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" }, "已上传": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" }, "上传失败": { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" } }
const resumableWorkflows = new Set(["uploading", "upload_failed", "album_ready", "album_failed", "review_ready", "review_failed"])

function getResourceUploadStatus(status: string | undefined): ResourceUploadStatus {
  if (status === "processing") return "uploading"
  if (status === "success" || status === "ready") return "uploaded"
  if (status === "failed") return "failed"
  return "not_uploaded"
}

export default function DramaSubmissionManagement() {
  const canAdd = usePerm("resource.drama-submission.add")
  const canReview = usePerm("resource.drama-submission.review")
  const canPublish = usePerm("resource.drama-submission.review")
  const canAuthorize = usePerm("resource.drama-submission.authorize")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [authorizationAlbumId, setAuthorizationAlbumId] = useState("")
  const [editingAlbumId, setEditingAlbumId] = useState("")
  const [detailAlbumId, setDetailAlbumId] = useState("")
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState<SubmissionForm>(emptyForm)
  const [dramas, setDramas] = useState<EligibleDramaItem[]>([])
  const [episodes, setEpisodes] = useState<EpisodeResourcePreview[]>([])
  const [dramaLoading, setDramaLoading] = useState(false)
  const [episodeLoading, setEpisodeLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [publishLoadingAlbumId, setPublishLoadingAlbumId] = useState("")
  const dramaRequestRef = useRef(0)
  const { draft, active, update, apply, reset } = useFilters(defaultFilters)
  const { page, pageSize, resetPage, paginationProps } = usePagination()

  const fetchList = useCallback(({ page, pageSize, filters }: { page: number; pageSize: number; filters?: FilterForm }) => {
    const selected = filters ?? defaultFilters
    return dramaSubmissionApi.list({ page, pageSize, albumId: selected.albumId.trim() || undefined, submittedName: selected.submittedName.trim() || undefined, dramaId: selected.dramaId.trim() || undefined, reviewStatus: selected.reviewStatus || undefined, publishStatus: selected.publishStatus || undefined })
  }, [])
  const { data, total, loading, error, refresh } = usePagedQuery<DramaSubmissionListItem, FilterForm>({ page, pageSize, filters: active, fetcher: fetchList })
  useEffect(() => { if (error) toast.error(error) }, [error])

  const searchDramas = useCallback(async (keyword = "") => {
    const requestId = ++dramaRequestRef.current
    setDramaLoading(true)
    try {
      const result = await dramaSubmissionApi.listEligibleDramas({ page: 1, pageSize: 50, keyword: keyword.trim() || undefined })
      if (requestId === dramaRequestRef.current) setDramas(result.list ?? [])
    } catch (err) {
      if (requestId === dramaRequestRef.current) toast.error(err instanceof Error ? err.message : "剧集加载失败")
    } finally {
      if (requestId === dramaRequestRef.current) setDramaLoading(false)
    }
  }, [])

  function openDrawer() {
    setEditingAlbumId(""); setForm(emptyForm()); setDramas([]); setEpisodes([]); setStep(1); setDrawerOpen(true); void searchDramas()
  }

  async function openResubmit(row: DramaSubmissionListItem) {
    try {
      const detail = await dramaSubmissionApi.versionDetail(row.albumId, row.version)
      setEditingAlbumId(row.albumId)
      setForm({ dramaId: row.dramaId, submittedName: detail.submittedName, coverUrl: detail.coverUrl, language: detail.language, year: String(detail.year), description: detail.description, dramaType: String(detail.dramaType), tagList: detail.tagList.map(String) })
      setDramas([]); setEpisodes([]); setStep(1); setDrawerOpen(true)
    } catch (err) { toast.error(err instanceof Error ? err.message : "提审信息加载失败") }
  }

  function selectDrama(dramaId: string) {
    const drama = dramas.find((item) => item.id === dramaId)
    setForm((current) => ({ ...current, dramaId, submittedName: drama?.name ?? "", coverUrl: drama?.coverUrl ?? "", language: drama?.language ?? "", description: drama?.description ?? "" }))
    setEpisodes([])
  }

  function validateForm() {
    const year = Number(form.year)
    if (!form.dramaId || !form.submittedName.trim() || !form.coverUrl.trim() || !form.language.trim() || !form.description.trim() || !form.dramaType) { toast.error("请完整填写提审信息"); return false }
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) { toast.error("请输入有效的上线年份"); return false }
    if (form.tagList.length < 1 || form.tagList.length > 3) { toast.error("请选择1至3个标签"); return false }
    return true
  }

  async function handleNext() {
    if (!validateForm()) return
    setEpisodeLoading(true)
    try {
      const [list, previousVersion] = await Promise.all([
        episodeApi.listByDrama(form.dramaId),
        editingAlbumId ? dramaSubmissionApi.detail(editingAlbumId).then((detail) => dramaSubmissionApi.versionDetail(editingAlbumId, detail.currentVersion)) : Promise.resolve(null),
      ])
      if (!list.length) { toast.error("该剧集尚未上传单集视频"); return }
      const previousByEpisode = new Map((previousVersion?.episodes ?? []).map((item) => [item.episodeId, item]))
      setEpisodes(list.map((item) => {
        const previous = previousByEpisode.get(item.id)
        const uploadStatus: ResourceUploadStatus = previous?.sourceUrl === item.videoUrl ? getResourceUploadStatus(previous.uploadStatus) : "not_uploaded"
        return { ...item, uploadStatus }
      }))
      setStep(2)
    } catch (err) { toast.error(err instanceof Error ? err.message : "单集资源加载失败") } finally { setEpisodeLoading(false) }
  }

  async function handleCreate() {
    if (!episodes.length) { toast.error("该剧集尚未上传单集视频"); return }
    setSubmitting(true)
    try {
      const payload = { dramaId: form.dramaId, submittedName: form.submittedName.trim(), coverUrl: form.coverUrl.trim(), language: form.language.trim(), year: Number(form.year), description: form.description.trim(), dramaType: Number(form.dramaType), tagList: form.tagList.map(Number), episodeIds: episodes.map((episode) => episode.id) }
      if (editingAlbumId) await dramaSubmissionApi.resubmit(editingAlbumId, payload)
      else await dramaSubmissionApi.create(payload)
      toast.success(editingAlbumId ? "新版本已创建，请在版本详情中模拟上传结果" : "剧目已创建，请在版本详情中模拟上传结果"); setDrawerOpen(false); setEditingAlbumId(""); await refresh()
    } catch (err) { toast.error(err instanceof Error ? err.message : "提审失败") } finally { setSubmitting(false) }
  }

  async function continueVersion(albumId: string, version: number) {
    try {
      await dramaSubmissionApi.continueVersion(albumId, version)
      toast.success("已从当前断点继续提审")
      setDetailRefreshKey((current) => current + 1)
      await refresh()
    } catch (err) { toast.error(err instanceof Error ? err.message : "继续提审失败") }
  }

  async function withdraw(albumId: string) {
    try {
      await dramaSubmissionApi.withdraw(albumId)
      toast.success("已撤回送审，当前版本保留，可重新创建版本")
      setDetailRefreshKey((current) => current + 1)
      await refresh()
    } catch (err) { toast.error(err instanceof Error ? err.message : "撤回失败") }
  }

  async function simulateReview(albumId: string, reviewStatus: 2 | 3) {
    try {
      await dramaSubmissionApi.simulateReview(albumId, reviewStatus)
      toast.success(reviewStatus === 2 ? "已模拟审核通过并上架" : "已模拟审核驳回")
      setDetailRefreshKey((current) => current + 1)
      await refresh()
    } catch (err) { toast.error(err instanceof Error ? err.message : "审核失败") }
  }

  async function togglePublishStatus(row: DramaSubmissionListItem) {
    setPublishLoadingAlbumId(row.albumId)
    try {
      await dramaSubmissionApi.togglePublishStatus(row.albumId)
      toast.success(row.publishStatus === 1 ? "下架成功" : "上架成功")
      setDetailRefreshKey((current) => current + 1)
      await refresh()
    } catch (err) { toast.error(err instanceof Error ? err.message : "上下架失败") }
    finally { setPublishLoadingAlbumId("") }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-[#e5e7eb] bg-white">
      <FilterBar actions={<FilterActions onQuery={() => { apply(); resetPage() }} onReset={() => { reset(); resetPage() }} />}>
        <FilterInput block label="剧目ID" placeholder="请输入剧目ID" value={draft.albumId} onChange={(value) => update("albumId", value)} />
        <FilterInput block label="剧目标题" placeholder="请输入剧目标题" value={draft.submittedName} onChange={(value) => update("submittedName", value)} />
        <FilterInput block label="剧集ID" placeholder="请输入剧集ID" value={draft.dramaId} onChange={(value) => update("dramaId", value)} />
        <SelectFilter block label="审核状态" placeholder="全部" value={draft.reviewStatus} options={reviewStatuses} onChange={(value) => update("reviewStatus", value)} />
        <SelectFilter block label="上架状态" placeholder="全部" value={draft.publishStatus} options={publishStatuses} onChange={(value) => update("publishStatus", value)} />
      </FilterBar>
      {canAdd && <div className="flex shrink-0 items-center border-b border-[#e5e7eb] px-5 py-3"><button type="button" onClick={openDrawer} className="flex h-[30px] items-center rounded-[6px] bg-[#38c08f] px-4 text-[13px] font-medium text-white hover:bg-[#2da87a]">新增剧目</button></div>}
      <FixedHeaderTable autoWidth minWidth={1050} columns={new Array(8).fill("")} loading={loading && data.length === 0} empty={data.length === 0} emptyText="暂无剧目提审记录" header={["剧目ID", "剧目标题", "剧集ID", "集数", "创建时间", "审核状态", "上架状态", "操作"].map((label) => <th key={label} className={thClass}>{label}</th>)}>
        {data.map((row, index) => <tr key={row.albumId} className={cn("hover:bg-[#f9fafb]", index < data.length - 1 && "border-b border-[#f3f4f6]")}>
          <td className="px-4 py-3 font-mono text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.albumId}</td><td className="px-4 py-3 text-[12.5px] font-medium text-[#111827] whitespace-nowrap">{row.submittedName}</td><td className="px-4 py-3 font-mono text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.dramaId}</td><td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{row.episodeCount}</td><td className="px-4 py-3 text-[12.5px] text-[#4b5563] whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
          <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={reviewStatusLabels[row.reviewStatus] ?? "未送审"} config={reviewBadgeConfig} /></td><td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={publishStatusLabels[row.publishStatus] ?? "下架"} config={{ "上架": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" } }} /></td>
          <td className="px-4 py-3 whitespace-nowrap"><div className="flex gap-2"><ActionButton onClick={() => setDetailAlbumId(row.albumId)}>查看详情</ActionButton><ActionButton variant="neutral" onClick={() => setAuthorizationAlbumId(row.albumId)}>授权记录</ActionButton>{canReview && row.reviewStatus === 1 && <><Popconfirm title="确认撤回送审？" description="撤回后当前版本将停止审核，后续可重新提审。" confirmText="确认撤回" onConfirm={() => withdraw(row.albumId)}><ActionButton variant="neutral">撤回送审</ActionButton></Popconfirm><ActionButton onClick={() => void simulateReview(row.albumId, 2)}>模拟通过</ActionButton><ActionButton variant="danger" onClick={() => void simulateReview(row.albumId, 3)}>模拟驳回</ActionButton></>}{canAdd && row.reviewStatus !== 1 && <>{resumableWorkflows.has(row.workflowStatus) && <ActionButton onClick={() => void continueVersion(row.albumId, row.version)}>继续提审</ActionButton>}<ActionButton onClick={() => void openResubmit(row)}>重新提审</ActionButton></>}{canPublish && row.publishStatus === 2 && <ActionButton disabled={publishLoadingAlbumId === row.albumId} onClick={() => void togglePublishStatus(row)}>{publishLoadingAlbumId === row.albumId ? "处理中..." : "上架"}</ActionButton>}{canPublish && row.publishStatus === 1 && <Popconfirm title="确认下架该剧目？" description="下架后小程序将无法继续播放该剧目。" confirmText="确认下架" onConfirm={() => togglePublishStatus(row)}><ActionButton variant="danger" disabled={publishLoadingAlbumId === row.albumId}>{publishLoadingAlbumId === row.albumId ? "处理中..." : "下架"}</ActionButton></Popconfirm>}</div></td>
        </tr>)}
      </FixedHeaderTable>
      <div className="shrink-0 border-t border-[#e5e7eb]"><ListPagination total={total} {...paginationProps} /></div>

      <RightDrawer open={drawerOpen} title={`${editingAlbumId ? "重新提审" : "新增剧目"} · ${step === 1 ? "基本信息" : "资源确认"}`} width={620} onClose={() => !submitting && setDrawerOpen(false)}>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className={cn("flex-1 min-h-0", step === 1 ? "space-y-5 overflow-y-auto p-6" : "flex flex-col overflow-hidden")}>
            {step === 1 ? <>
              {editingAlbumId ? <FormInput label="剧集ID" placeholder="剧集ID" disabled value={form.dramaId} onChange={() => {}} /> : <PromotionOptionSelect label="剧集名称" required searchable loading={dramaLoading} value={form.dramaId} placeholder="请选择尚未提审的剧集" searchPlaceholder="输入剧集名称或完整剧集ID" options={dramas.map((drama) => ({ value: drama.id, label: drama.name, extra: <span className="font-mono text-[11px] text-[#9ca3af]">ID: {drama.id} · {drama.episodeCount}集</span> }))} onSearch={(keyword) => void searchDramas(keyword)} onChange={selectDrama} />}
              <SubmissionCoverUpload value={form.coverUrl} onChange={(coverUrl) => setForm((current) => ({ ...current, coverUrl }))} />
              <FormInput label="剧目标题" required placeholder="请输入剧目标题" value={form.submittedName} onChange={(submittedName) => setForm((current) => ({ ...current, submittedName }))} /><FormInput label="原生语种" required disabled placeholder="请先选择剧集" value={form.language} onChange={() => {}} /><FormInput label="上线年份" required type="number" min={1900} max={new Date().getFullYear() + 1} step={1} placeholder="请输入上线年份" value={form.year} onChange={(year) => setForm((current) => ({ ...current, year }))} /><FormSelect label="剧目类型" required value={form.dramaType} placeholder="请选择剧目类型" options={dramaTypes} onChange={(dramaType) => setForm((current) => ({ ...current, dramaType }))} />
              <div className="flex flex-col gap-1.5"><label className="text-[13px] font-medium text-[#374151]">标签<span className="ml-0.5 text-[#f04438]">*</span><span className="ml-1 font-normal text-[#9ca3af]">最多3个</span></label><MultiSelectFilter width="w-full" maxTagCount={3} placeholder="请选择1至3个标签" options={tagOptions} value={form.tagList} onChange={(tagList) => { if (tagList.length <= 3) setForm((current) => ({ ...current, tagList })); else toast.error("最多选择3个标签") }} /></div><div className="flex flex-col gap-1.5"><label className="text-[13px] font-medium text-[#374151]">剧目描述<span className="ml-0.5 text-[#f04438]">*</span></label><textarea rows={5} placeholder="请输入剧目描述" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full resize-none rounded-[6px] border border-[#d1d5db] bg-white px-3 py-2 text-[13px] text-[#374151] outline-none placeholder:text-[#9ca3af] focus:border-[#38c08f]" /></div>
            </> : <FixedHeaderTable autoWidth minWidth={500} columns={new Array(2).fill("")} loading={false} empty={episodes.length === 0} emptyText="暂无单集资源" header={["单集", "资源状态"].map((label) => <th key={label} className={thClass}>{label}</th>)}>
              {episodes.map((episode, index) => <tr key={episode.id} className={cn("hover:bg-[#f9fafb]", index < episodes.length - 1 && "border-b border-[#f3f4f6]")}><td className="whitespace-nowrap px-4 py-3 text-[13px] font-medium">第{episode.episodeNo}集</td><td className="whitespace-nowrap px-4 py-3"><StatusBadge status={resourceUploadLabels[episode.uploadStatus]} config={resourceUploadConfig} /></td></tr>)}
            </FixedHeaderTable>}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-[#e5e7eb] px-6 py-4"><button type="button" disabled={submitting || episodeLoading} onClick={() => step === 2 ? setStep(1) : setDrawerOpen(false)} className="h-[34px] rounded-[6px] border border-[#d1d5db] px-4 text-[13px] text-[#374151] disabled:opacity-50">{step === 2 ? "上一步" : "取消"}</button><button type="button" disabled={submitting || episodeLoading} onClick={() => void (step === 1 ? handleNext() : handleCreate())} className="h-[34px] rounded-[6px] bg-[#13a673] px-4 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{episodeLoading ? "加载中..." : submitting ? "提审中..." : step === 1 ? "下一步" : "确认提审"}</button></div>
        </div>
      </RightDrawer>
      <SubmissionDetailDrawers albumId={detailAlbumId} open={Boolean(detailAlbumId)} refreshKey={detailRefreshKey} onClose={() => { setDetailAlbumId(""); void refresh() }} />
      <SubmissionAuthorizationDrawer albumId={authorizationAlbumId} open={Boolean(authorizationAlbumId)} canEdit={canAuthorize} onClose={() => setAuthorizationAlbumId("")} />
    </div>
  )
}
