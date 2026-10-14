import { get, post, put } from "../api-client"
import type { PageData } from "../types"

export type DramaSubmissionUploadStatus = "processing" | "success" | "failed" | "ready"
export type DramaSubmissionWorkflowStatus = "draft" | "uploading" | "upload_failed" | "album_ready" | "album_failed" | "review_ready" | "review_failed" | "reviewing" | "approved" | "rejected" | "withdrawn"
export type DramaSubmissionReviewStatus = 0 | 1 | 2 | 3 | 4
export type DramaSubmissionPublishStatus = 1 | 2

export interface DramaSubmissionListItem {
  albumId: string
  appId: string
  submittedName: string
  dramaId: string
  episodeCount: number
  version: number
  createdAt: string
  reviewStatus: DramaSubmissionReviewStatus
  publishStatus: DramaSubmissionPublishStatus
  workflowStatus: DramaSubmissionWorkflowStatus
}

export interface EligibleDramaItem {
  id: string
  name: string
  description: string
  coverUrl: string
  language: string
  episodeCount: number
}

export interface DramaSubmissionCreateDto {
  dramaId: string
  submittedName: string
  coverUrl: string
  language: string
  year: number
  description: string
  dramaType: number
  tagList: number[]
  episodeIds: string[]
}

export interface DramaSubmissionVersionItem {
  version: number
  submittedName: string
  coverUrl: string
  language: string
  year: number
  description: string
  dramaType: number
  tagList: number[]
  reviewId: string
  reviewStatus: DramaSubmissionReviewStatus
  submittedAt?: string
  reviewedAt?: string
  withdrawnAt?: string
  rejectionReason: string
  workflowStatus: DramaSubmissionWorkflowStatus
  workflowError: string
  remoteVersion: number
  updatedAt: string
}

export interface DramaSubmissionDetail {
  albumId: string
  dramaId: string
  appId: string
  currentVersion: number
  publishStatus: DramaSubmissionPublishStatus
  versions: DramaSubmissionVersionItem[]
}

export interface DramaSubmissionEpisodeItem {
  mediaId: string
  episodeId: string
  episodeNo: number
  sourceUrl: string
  uploadStatus: DramaSubmissionUploadStatus
  jobId: string
  vid: string
  reviewStatus: DramaSubmissionReviewStatus
  rejectionReason: string
  uploadError: string
  retryCount: number
  lastAttemptAt?: string
  reused: boolean
}

export interface DramaSubmissionVersionDetail extends DramaSubmissionVersionItem {
  albumId: string
  dramaId: string
  episodes: DramaSubmissionEpisodeItem[]
}

export type DramaSubmissionListParams = Record<string, unknown> & {
  page: number
  pageSize: number
  albumId?: string
  submittedName?: string
  dramaId?: string
  reviewStatus?: string
  publishStatus?: string
}

export const dramaSubmissionApi = {
  list: (params: DramaSubmissionListParams) => get<PageData<DramaSubmissionListItem>>("/drama-submissions", params),
  listEligibleDramas: (params: { page: number; pageSize: number; keyword?: string }) =>
    get<PageData<EligibleDramaItem>>("/drama-submissions/eligible-dramas", params),
  create: (body: DramaSubmissionCreateDto) => post<DramaSubmissionListItem>("/drama-submissions", body),
  detail: (albumId: string) => get<DramaSubmissionDetail>(`/drama-submissions/${albumId}`),
  versionDetail: (albumId: string, version: number) => get<DramaSubmissionVersionDetail>(`/drama-submissions/${albumId}/versions/${version}`),
  resubmit: (albumId: string, body: DramaSubmissionCreateDto) => put<DramaSubmissionListItem>(`/drama-submissions/${albumId}/resubmit`, body),
  withdraw: (albumId: string) => put<void>(`/drama-submissions/${albumId}/withdraw`, {}),
  simulateReview: (albumId: string, reviewStatus: 2 | 3) =>
    put<void>(`/drama-submissions/${albumId}/simulate-review`, { reviewStatus }),
  retryMedia: (albumId: string, version: number, mediaId: string) =>
    put<void>(`/drama-submissions/${albumId}/versions/${version}/media/${mediaId}/retry`, {}),
  simulateMediaSuccess: (albumId: string, version: number, mediaId: string) =>
    put<void>(`/drama-submissions/${albumId}/versions/${version}/media/${mediaId}/simulate-success`, {}),
  simulateMediaFailure: (albumId: string, version: number, mediaId: string) =>
    put<void>(`/drama-submissions/${albumId}/versions/${version}/media/${mediaId}/simulate-failure`, {}),
  togglePublishStatus: (albumId: string) =>
    put<void>(`/drama-submissions/${albumId}/toggle-publish-status`, {}),
  continueVersion: (albumId: string, version: number) =>
    put<void>(`/drama-submissions/${albumId}/versions/${version}/continue`, {}),
}

