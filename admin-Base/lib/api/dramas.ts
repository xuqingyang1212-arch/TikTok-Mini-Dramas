import { del, get, post, put, uploadFile, uploadFileWithProgress } from "../api-client"
import type { PageData } from "../types"
import type { UserListQueryParams } from "./users"

export interface DramaCreateDto { name: string; coverUrl: string; language: string; paywallEpisode: number }
export interface EpisodeItem { id: string; dramaId: string; episodeNo: number; videoUrl: string; duration: number; fileSize: number }
export const dramaApi = {
  list: <T = unknown>(params?: UserListQueryParams) => get<PageData<T>>("/dramas", params),
  getById: (id: string) => get<{ id: string; name: string; coverUrl?: string }>(`/dramas/${id}`),
  create: (body: DramaCreateDto) => post<{ id?: string }>("/dramas", body),
  update: (id: string, body: DramaCreateDto) => put<{ id?: string }>(`/dramas/${id}`, body),
  toggleStatus: (id: string) => put<{ id: string }>(`/dramas/${id}/toggle-status`, {}),
}
export const episodeApi = {
  listByDrama: (dramaId: string) => get<EpisodeItem[]>(`/dramas/${dramaId}/episodes`),
  batchCreate: (dramaId: string, episodes: { episodeNo: number; videoUrl: string; duration?: number; fileSize?: number }[]) => post<EpisodeItem[]>(`/dramas/${dramaId}/episodes`, { episodes }),
  update: (dramaId: string, episodeId: string, body: { videoUrl: string; duration?: number; fileSize?: number }) => put<EpisodeItem>(`/dramas/${dramaId}/episodes/${episodeId}`, body),
  delete: (dramaId: string, episodeId: string) => del<{ id: string }>(`/dramas/${dramaId}/episodes/${episodeId}`),
}
export const uploadApi = {
  image: (file: File) => uploadFile<{ url: string }>("/upload/image", file),
  video: (file: File) => uploadFile<{ url: string; size: number }>("/upload/video", file),
  videoWithProgress: (file: File, onProgress?: (percent: number) => void) => uploadFileWithProgress<{ url: string; size: number }>("/upload/video", file, onProgress),
}
