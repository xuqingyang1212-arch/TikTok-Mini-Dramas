"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/I18nProvider"
import { BeansOptionCard, type BeansOption } from "./BeansOptionCard"
import { VipOptionCard, type VipOption } from "./VipOptionCard"

interface PaymentSheetProps {
  /** Beans per episode, shown in the header price line. */
  beansPerEp: number
  beansOptions: BeansOption[]
  vipOptions: VipOption[]
  onSelectBeans: (option: BeansOption) => void
  onSelectVip: (option: VipOption) => void
  onClose: () => void
  closeDisabled?: boolean
}

/**
 * Presentational bottom payment sheet.
 * Pure UI: receives already-mapped option arrays and select callbacks.
 * Fixed to the bottom, dark glass style, top rounded, safe-area aware,
 * scrolls internally when content exceeds the max height.
 */
export function PaymentSheet({
  beansPerEp,
  beansOptions,
  vipOptions,
  onSelectBeans,
  onSelectVip,
  onClose,
  closeDisabled = false,
}: PaymentSheetProps) {
  const { t } = useI18n()

  return (
    <div className="payment-sheet payment-sheet--select animate-slide-up">
      {/* Header: price + close */}
      <div className="flex flex-shrink-0 items-center justify-between px-5 pb-3 pt-5">
        <span className="flex items-center text-[17px] text-white/85">
          {t("payment.price")}
          <img
            src="/beans.png"
            alt="Beans"
            className="mx-1.5 h-5 w-5 object-contain"
            draggable={false}
          />
          <span className="font-semibold text-white">{beansPerEp}</span>
          <span className="text-white/60">{t("payment.perEpisode")}</span>
        </span>
        <button
          type="button"
          onClick={closeDisabled ? undefined : onClose}
          aria-label={t("common.close")}
          disabled={closeDisabled}
          className="-mr-1 flex h-11 w-11 items-center justify-center disabled:cursor-not-allowed"
        >
          <span className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5",
            closeDisabled && "opacity-40",
          )}>
            <X size={17} className="text-white/70" />
          </span>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="hide-scrollbar min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 pb-2">
        {/* Beans tiers: 2-column grid */}
        {beansOptions.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {beansOptions.map((option) => (
              <BeansOptionCard key={option.key} option={option} onSelect={onSelectBeans} />
            ))}
          </div>
        )}

        {/* VIP section */}
        {vipOptions.length > 0 && (
          <div className="mt-5">
            <div className="mb-3 flex items-baseline gap-2 px-1">
              <span className="flex-shrink-0 text-[19px] font-bold text-[#f5b544]">
                {t("payment.vip")}
              </span>
              <span className="min-w-0 text-[14px] text-white/50">
                {t("payment.vipSubtitle")}
              </span>
            </div>
            <div className="space-y-3">
              {vipOptions.map((option) => (
                <VipOptionCard key={option.planId} option={option} onSelect={onSelectVip} />
              ))}
            </div>
          </div>
        )}

        <div className="h-[calc(env(safe-area-inset-bottom,0px)+16px)]" aria-hidden="true" />
      </div>
    </div>
  )
}
