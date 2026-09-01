"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  Crown,
  Loader2,
  ReceiptText,
  RefreshCw,
} from "lucide-react"
import {
  miniApi,
  type PaymentRecords,
  type SubscriptionPaymentRecord,
  type UnlockPaymentRecord,
} from "@/lib/api"
import { useI18n } from "@/lib/i18n/I18nProvider"
import type { Locale, TranslationKey } from "@/lib/i18n/messages"

interface PurchaseRecordsPageProps {
  userId: string
  onBack: () => void
}

type DisplayRecord =
  | ({ kind: "subscription" } & SubscriptionPaymentRecord)
  | ({ kind: "unlock" } & UnlockPaymentRecord)

const periodLabelKeys: Record<SubscriptionPaymentRecord["period"], TranslationKey> = {
  weekly: "purchase.weeklyMember",
  monthly: "purchase.monthlyMember",
  quarterly: "purchase.quarterlyMember",
  half_yearly: "purchase.halfYearlyMember",
  yearly: "purchase.yearlyMember",
}

function getBrowserTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return timeZone || undefined
}

function formatPaidAt(paidAt: string, locale: Locale) {
  const date = new Date(paidAt)
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      timeZone: getBrowserTimeZone(),
      year: "numeric",
      month: locale === "zh" ? "numeric" : "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  // Keep compatibility with older API values that did not include a timezone.
  const matched = paidAt.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!matched) return paidAt

  const [, year, month, day, hour, minute] = matched
  if (locale === "zh") {
    return `${year}年${Number(month)}月${Number(day)}日 ${hour}:${minute}`
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: getBrowserTimeZone(),
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)))
}

function formatEpisodes(episodes: number[], locale: Locale) {
  if (episodes.length === 0) return ""

  const sorted = [...new Set(episodes)].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index]
    if (current === end + 1) {
      end = current
      continue
    }

    ranges.push(start === end ? `${start}` : `${start}-${end}`)
    start = current
    end = current
  }

  return ranges.join(locale === "zh" ? "、" : ", ")
}

function PurchaseTime({ paidAt }: { paidAt: string }) {
  const { locale } = useI18n()

  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[13px] text-white/42">
      <CalendarDays size={14} className="flex-shrink-0 text-white/30" />
      <span className="truncate">{formatPaidAt(paidAt, locale)}</span>
    </div>
  )
}

function SubscriptionRecordCard({ record }: { record: DisplayRecord & { kind: "subscription" } }) {
  const { t } = useI18n()

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#f6a647]/20 bg-gradient-to-br from-[#2b211a] via-[#1b1819] to-[#131316] p-4 shadow-[0_8px_26px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ffc774]/65 to-transparent" />
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#ffc46d]/25 bg-[#f59a38]/12 text-[#ffc46d]">
          <Crown size={23} strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold text-white">
            {t(periodLabelKeys[record.period] ?? "purchase.memberSubscription")}
          </h2>
          <PurchaseTime paidAt={record.paidAt} />
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[19px] font-bold tabular-nums text-white">${record.amount.toFixed(2)}</p>
        </div>
      </div>
    </article>
  )
}

function UnlockRecordCard({ record }: { record: DisplayRecord & { kind: "unlock" } }) {
  const { locale, t } = useI18n()
  const episodeRange = formatEpisodes(record.episodes, locale)

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#25232b] via-[#19181e] to-[#121216] p-4 shadow-[0_8px_26px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055]">
          <img src="/beans.png" alt="Beans" className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold text-white">
            {record.dramaName || t("purchase.dramaUnlock")}
          </h2>
          <p className="mt-1 truncate text-[14px] text-white/50">
            {t("purchase.unlockCount", { count: record.unlockCount })}
            {episodeRange ? ` · ${t("purchase.episodeRange", { range: episodeRange })}` : ""}
          </p>
          <PurchaseTime paidAt={record.paidAt} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <img src="/beans.png" alt="" aria-hidden="true" className="h-[18px] w-[18px] object-contain" />
          <span className="text-[18px] font-bold tabular-nums text-white">{record.beansCost}</span>
        </div>
      </div>
    </article>
  )
}

export function PurchaseRecordsPage({ userId, onBack }: PurchaseRecordsPageProps) {
  const { t } = useI18n()
  const [records, setRecords] = useState<PaymentRecords | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)

    try {
      const data = await miniApi.getPaymentRecords(userId)
      setRecords({
        subscriptions: data.subscriptions ?? [],
        unlocks: data.unlocks ?? [],
      })
    } catch (error) {
      console.error("Failed to load payment records:", error)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const displayRecords = useMemo<DisplayRecord[]>(() => {
    if (!records) return []

    return [
      ...records.subscriptions.map((record) => ({ ...record, kind: "subscription" as const })),
      ...records.unlocks.map((record) => ({ ...record, kind: "unlock" as const })),
    ].sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  }, [records])

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <header className="safe-area-top relative z-10 flex-shrink-0 border-b border-white/[0.07] bg-black/92 backdrop-blur-xl">
        <div className="relative flex h-14 items-center justify-center px-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("common.back")}
            className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full text-white/82 transition-colors active:bg-white/10"
          >
            <ArrowLeft size={23} />
          </button>
          <h1 className="text-[19px] font-semibold">{t("purchase.title")}</h1>
        </div>
      </header>

      <main className="hide-scrollbar flex-1 overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-4">
        {loading ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-white/45">
            <Loader2 size={27} className="animate-spin text-[#ff9b42]" />
            <p className="text-[15px]">{t("purchase.loading")}</p>
          </div>
        ) : loadFailed ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] text-white/35">
              <ReceiptText size={27} />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold">{t("purchase.loadFailed")}</h2>
            <p className="mt-2 text-[15px] leading-6 text-white/42">
              {t("purchase.loadFailedDescription")}
            </p>
            <button
              type="button"
              onClick={loadRecords}
              className="mt-5 flex min-h-11 items-center gap-2 rounded-full bg-[#ff8a34] px-6 text-[16px] font-semibold text-white active:bg-[#f47c24]"
            >
              <RefreshCw size={16} />
              {t("purchase.reload")}
            </button>
          </div>
        ) : displayRecords.length === 0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.045] text-white/28">
              <ReceiptText size={29} />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold text-white/88">{t("purchase.empty")}</h2>
            <p className="mt-2 text-[15px] text-white/42">{t("purchase.emptyDescription")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayRecords.map((record) =>
              record.kind === "subscription" ? (
                <SubscriptionRecordCard key={`subscription-${record.orderNo}`} record={record} />
              ) : (
                <UnlockRecordCard key={`unlock-${record.orderNo}`} record={record} />
              )
            )}
          </div>
        )}
      </main>
    </div>
  )
}
