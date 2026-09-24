import { miniApi, type Drama, type Episode, type MediaEventReportRequest } from "@/lib/api"

export type IapMediaEventName =
  | "video_play_request"
  | "ep_play"
  | "add_to_wishlist"
  | "start_unlock"
  | "complete_watching"
  | "unlock_panel_show_request"
  | "unlock_panel_show"
  | "unlock_panel_click"
  | "unlock_success"

export type IaaMediaEventName = "video_play_request" | "ep_play" | "minis_ad_show"

export interface EpisodeEventContext {
  userId: string
  drama: Drama
  episodes: Episode[]
  paywallEpisode?: number
  episodeNo: number
}

export interface AdEventContext extends EpisodeEventContext {
  appName: string
  clientKey: string
  openId: string
}

function createReportId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `media-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getEffectivePaywallEpisode(context: EpisodeEventContext) {
  if (context.paywallEpisode !== undefined) return context.paywallEpisode
  return context.episodes.find((episode) => !episode.isFree)?.episodeNo ?? null
}

export function getLastFreeEpisode(context: EpisodeEventContext) {
  const paywallEpisode = getEffectivePaywallEpisode(context)
  return paywallEpisode !== null && paywallEpisode > 1 ? paywallEpisode - 1 : null
}

function buildEpisodeFlags(context: EpisodeEventContext) {
  const paywallEpisode = getEffectivePaywallEpisode(context)
  const hasPaidEpisode = paywallEpisode !== null && paywallEpisode <= context.drama.episodeCount
  const lastFreeEpisode = getLastFreeEpisode(context)

  return {
    if_last_free_ep: lastFreeEpisode === null ? null : Number(context.episodeNo === lastFreeEpisode),
    if_first_paid_ep: hasPaidEpisode ? Number(context.episodeNo === paywallEpisode) : null,
    if_last_ep: Number(context.episodeNo === context.drama.episodeCount),
  }
}

export function buildPlaybackParams(context: EpisodeEventContext, isIaa: boolean) {
  const params: Record<string, unknown> = {
    minis_drama_name: context.drama.name,
    minis_drama_id: context.drama.id,
    episode_number: String(context.episodeNo),
  }

  if (isIaa) {
    params.if_last_ep = Number(context.episodeNo === context.drama.episodeCount)
    return params
  }

  return { ...params, ...buildEpisodeFlags(context) }
}

export function buildIapParams(context: EpisodeEventContext) {
  return {
    minis_drama_name: context.drama.name,
    minis_drama_id: context.drama.id,
    episode_number: String(context.episodeNo),
    ...buildEpisodeFlags(context),
  }
}

export function buildAdShowParams(context: AdEventContext) {
  const previousEpisodeNo = Math.max(1, context.episodeNo - 1)
  return {
    minis_drama_name: context.drama.name,
    minis_drama_id: context.drama.id,
    episode_number: String(previousEpisodeNo),
    if_last_ep: Number(previousEpisodeNo === context.drama.episodeCount),
    if_first_time: Number(!context.episodes.some((episode) => episode.unlockType === "ad")),
    minis_name: context.appName,
    minis_id: context.clientKey,
    open_id: context.openId,
    ad_type: "RewardedVideoAd",
  }
}

export async function reportDemoMediaEvent(input: {
  userId: string
  dramaId: string
  episodeNo: number
  eventName: IapMediaEventName | IaaMediaEventName
  params: Record<string, unknown>
}) {
  const eventOccurredAt = new Date().toISOString()
  const sdkReportedAt = new Date().toISOString()
  const callbackResult = {
    isSuccess: true,
  }
  const sdkCallbackAt = new Date().toISOString()
  const report: MediaEventReportRequest = {
    reportId: createReportId(),
    userId: input.userId,
    dramaId: input.dramaId,
    episodeNo: input.episodeNo,
    eventName: input.eventName,
    status: "success",
    params: input.params,
    result: {
      eventOccurredAt,
      canIUseReportEvent: true,
      reportEvent: {
        eventName: input.eventName,
        params: input.params,
        sdkReportedAt,
        sdkCallbackAt,
        callbackResult,
      },
    },
  }

  try {
    await miniApi.reportMediaEvent(report)
  } catch (error) {
    console.error(`Failed to record media event ${input.eventName}:`, error)
  }
}
