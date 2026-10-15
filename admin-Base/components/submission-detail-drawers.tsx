"use client"

import { useCallback, useEffect, useState } from "react"
import { dramaSubmissionApi, type DramaSubmissionDetail, type DramaSubmissionVersionDetail } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"
import { usePerm } from "@/components/admin-layout"
import { ActionButton, FixedHeaderTable, RightDrawer, StatusBadge, thClass } from "@/components/shared"

const reviewLabels: Record<number, string> = { 0: "未送审", 1: "审核中", 2: "通过", 3: "驳回", 4: "已撤回" }
const reviewConfig = { "未送审": { bg: "bg-[#f3f4f6]", text: "text-[#6b7280]" }, "审核中": { bg: "bg-[#fff7ed]", text: "text-[#ea580c]" }, "通过": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" }, "驳回": { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" }, "已撤回": { bg: "bg-[#eef2ff]", text: "text-[#4f46e5]" } }
const uploadStatusLabels: Record<string, string> = { processing: "处理中", success: "成功", failed: "失败", ready: "成功" }
const uploadStatusConfig = { "处理中": { bg: "bg-[#eff6ff]", text: "text-[#2563eb]" }, "成功": { bg: "bg-[#ecfdf5]", text: "text-[#059669]" }, "失败": { bg: "bg-[#fef2f2]", text: "text-[#dc2626]" } }
const tableCellClass = "whitespace-nowrap px-4 py-3"

interface SubmissionDetailDrawersProps {
  albumId: string
  open: boolean
  refreshKey?: number
  onClose: () => void
}

export function SubmissionDetailDrawers({ albumId, open, refreshKey = 0, onClose }: SubmissionDetailDrawersProps) {
  const canAdd = usePerm("resource.drama-submission.add")
  const [detail, setDetail] = useState<DramaSubmissionDetail | null>(null)
  const [versionDetail, setVersionDetail] = useState<DramaSubmissionVersionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const reloadVersion = useCallback(async (version: number) => {
    const [nextDetail, nextVersion] = await Promise.all([
      dramaSubmissionApi.detail(albumId),
      dramaSubmissionApi.versionDetail(albumId, version),
    ])
    setDetail(nextDetail)
    setVersionDetail(nextVersion)
  }, [albumId])

  async function retryMedia(mediaId: string) {
    if (!versionDetail) return
    setActionLoading(true)
    try {
      await dramaSubmissionApi.retryMedia(albumId, versionDetail.version, mediaId)
      await reloadVersion(versionDetail.version)
      toast.success("已重启上传，请模拟本次上传结果")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重试上传失败")
    } finally {
      setActionLoading(false)
    }
  }

  async function simulateMediaSuccess(mediaId: string) {
    if (!versionDetail) return
    setActionLoading(true)
    try {
      await dramaSubmissionApi.simulateMediaSuccess(albumId, versionDetail.version, mediaId)
      await reloadVersion(versionDetail.version)
      toast.success("已模拟上传成功")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "模拟上传成功失败")
    } finally {
      setActionLoading(false)
    }
  }

  async function simulateMediaFailure(mediaId: string) {
    if (!versionDetail) return
    setActionLoading(true)
    try {
      await dramaSubmissionApi.simulateMediaFailure(albumId, versionDetail.version, mediaId)
      await reloadVersion(versionDetail.version)
      toast.success("上传失败")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "模拟上传失败")
    } finally {
      setActionLoading(false)
    }
  }

  async function simulateRemainingMedia(outcome: "success" | "failure") {
    if (!versionDetail) return
    const remaining = versionDetail.episodes.filter((episode) => episode.uploadStatus === "processing")
    if (!remaining.length) {
      toast.info("没有待处理的剧集")
      return
    }
    setActionLoading(true)
    try {
      for (const episode of remaining) {
        if (outcome === "success") {
          await dramaSubmissionApi.simulateMediaSuccess(albumId, versionDetail.version, episode.mediaId)
        } else {
          await dramaSubmissionApi.simulateMediaFailure(albumId, versionDetail.version, episode.mediaId)
        }
      }
      await reloadVersion(versionDetail.version)
      toast.success(outcome === "success" ? `已批量模拟 ${remaining.length} 集上传成功` : `已批量模拟 ${remaining.length} 集上传失败`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量处理失败")
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !albumId) return
    setLoading(true)
    setDetail(null)
    setVersionDetail(null)
    dramaSubmissionApi.detail(albumId).then(setDetail).catch((error) => toast.error(error instanceof Error ? error.message : "详情加载失败")).finally(() => setLoading(false))
  }, [albumId, open, refreshKey])

  async function openVersion(version: number) {
    try {
      setVersionDetail(await dramaSubmissionApi.versionDetail(albumId, version))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "版本详情加载失败")
    }
  }

  return (
    <>
      <RightDrawer open={open} title="剧目详情" width="min(1080px, 92vw)" onClose={onClose}>
        {loading ? <div className="flex-1 overflow-y-auto"><div className="py-16 text-center text-[13px] text-[#9ca3af]">加载中...</div></div> : detail && <FixedHeaderTable autoWidth minWidth={900} columns={new Array(6).fill("")} loading={false} empty={detail.versions.length === 0} emptyText="暂无版本" header={["版本", "剧目标题", "审核状态", "提交时间", "审核说明", "操作"].map((label) => <th key={label} className={thClass}>{label}</th>)}>
          {detail.versions.map((version, index) => <tr key={version.version} className={cn("hover:bg-[#f9fafb]", index < detail.versions.length - 1 && "border-b border-[#f3f4f6]")}><td className={`${tableCellClass} text-[13px] font-medium`}><div className="flex items-center gap-2">版本 {version.version}{version.version === detail.onlineVersion && <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-medium text-[#059669]">线上版本</span>}</div></td><td className={`${tableCellClass} max-w-80 truncate text-[13px]`} title={version.submittedName}>{version.submittedName}</td><td className={tableCellClass}><StatusBadge status={reviewLabels[version.reviewStatus]} config={reviewConfig} /></td><td className={`${tableCellClass} text-[12px] text-[#6b7280]`}>{version.submittedAt ? formatDateTime(version.submittedAt) : "-"}</td><td className={`${tableCellClass} max-w-72 truncate text-[12px] text-[#6b7280]`} title={version.rejectionReason || undefined}>{version.rejectionReason || "-"}</td><td className={tableCellClass}><ActionButton onClick={() => void openVersion(version.version)}>查看详情</ActionButton></td></tr>)}
        </FixedHeaderTable>}
      </RightDrawer>
      <RightDrawer open={Boolean(versionDetail)} title={versionDetail ? `版本 ${versionDetail.version} 详情` : "版本详情"} width="min(1200px, 94vw)" zIndex={60} onClose={() => setVersionDetail(null)}>
        {versionDetail && <>
          {canAdd && versionDetail.episodes.some((episode) => episode.uploadStatus === "processing") && <div className="flex shrink-0 items-center justify-end gap-2 border-b border-[#e5e7eb] px-5 py-3">
            <ActionButton disabled={actionLoading} onClick={() => void simulateRemainingMedia("success")}>批量模拟成功</ActionButton>
            <ActionButton variant="danger" disabled={actionLoading} onClick={() => void simulateRemainingMedia("failure")}>批量模拟失败</ActionButton>
          </div>}
          <FixedHeaderTable autoWidth minWidth={520} columns={new Array(3).fill("")} loading={false} empty={versionDetail.episodes.length === 0} emptyText="暂无单集" header={["集数", "上传状态", "操作"].map((label) => <th key={label} className={thClass}>{label}</th>)}>
            {versionDetail.episodes.map((episode, index) => <tr key={episode.episodeId} className={cn("hover:bg-[#f9fafb]", index < versionDetail.episodes.length - 1 && "border-b border-[#f3f4f6]")}><td className={`${tableCellClass} text-[13px] font-medium`}>第{episode.episodeNo}集</td><td className={tableCellClass}><StatusBadge status={uploadStatusLabels[episode.uploadStatus] || episode.uploadStatus} config={uploadStatusConfig} /></td><td className={tableCellClass}><div className="flex gap-2">{canAdd && episode.uploadStatus === "processing" && <><ActionButton disabled={actionLoading} onClick={() => void simulateMediaSuccess(episode.mediaId)}>成功</ActionButton><ActionButton variant="danger" disabled={actionLoading} onClick={() => void simulateMediaFailure(episode.mediaId)}>失败</ActionButton></>}{canAdd && episode.uploadStatus === "failed" && <ActionButton disabled={actionLoading} onClick={() => void retryMedia(episode.mediaId)}>重试上传</ActionButton>}</div></td></tr>)}
          </FixedHeaderTable>
        </>}
      </RightDrawer>
    </>
  )
}
