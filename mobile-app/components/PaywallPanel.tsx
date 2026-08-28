"use client"

import { useMemo, useState, useEffect } from "react"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { miniApi, type PaywallData, type PaywallTier, type SubscriptionPlan } from "@/lib/api"
import { useI18n } from "@/lib/i18n/I18nProvider"
import type { TranslationKey } from "@/lib/i18n/messages"
import { PaymentSheet } from "./payment/PaymentSheet"
import type { BeansOption } from "./payment/BeansOptionCard"
import type { VipOption } from "./payment/VipOptionCard"
import type { VipTheme } from "./payment/VipDiamondIcon"

interface PaywallPanelProps {
  dramaId: string
  userId: string
  currentEpisode: number
  onClose: () => void
  onPaySuccess: () => void
  /** Optional app primary key; required by the API only before login. */
  appId?: string
}

type PayStep = "select" | "processing" | "result"

const PERIOD_LABEL_KEYS: Record<SubscriptionPlan["period"], TranslationKey> = {
  weekly: "payment.weeklyVip",
  monthly: "payment.monthlyVip",
  quarterly: "payment.quarterlyVip",
  half_yearly: "payment.halfYearlyVip",
  yearly: "payment.yearlyVip",
}

const PERIOD_DESCRIPTION_KEYS: Record<SubscriptionPlan["period"], TranslationKey> = {
  weekly: "payment.weeklyDescription",
  monthly: "payment.monthlyDescription",
  quarterly: "payment.quarterlyDescription",
  half_yearly: "payment.halfYearlyDescription",
  yearly: "payment.yearlyDescription",
}

// Keep each subscription period visually stable even if the API order changes.
const VIP_THEME_BY_PERIOD: Record<SubscriptionPlan["period"], VipTheme> = {
  weekly: "gold",
  monthly: "purple",
  quarterly: "blue",
  half_yearly: "rose",
  yearly: "teal",
}

/** Pick the display price (already in dollars) based on the device OS. */
function pickPrice(plan: SubscriptionPlan): number {
  const isAndroid =
    typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("android")
  return isAndroid
    ? plan.googlePrice || plan.applePrice || 0
    : plan.applePrice || plan.googlePrice || 0
}

export function PaywallPanel({
  dramaId,
  userId,
  onClose,
  onPaySuccess,
  appId,
}: PaywallPanelProps) {
  const { t } = useI18n()
  const [paywall, setPaywall] = useState<PaywallData | null>(null)
  const [loading, setLoading] = useState(true)
  const [payStep, setPayStep] = useState<PayStep>("select")
  const [orderNo, setOrderNo] = useState("")
  const [paySuccess, setPaySuccess] = useState(false)
  const [processingTextKey, setProcessingTextKey] = useState<TranslationKey>("payment.creatingOrder")

  useEffect(() => {
    miniApi
      .getPaywall(dramaId, userId, appId)
      .then((data) => setPaywall(data))
      .catch((err) => console.error("Failed to load paywall:", err))
      .finally(() => setLoading(false))
  }, [dramaId, userId, appId])

  // Map API tiers -> presentational beans options (data / view separation).
  const beansOptions = useMemo<BeansOption[]>(() => {
    if (!paywall) return []
    return paywall.tiers.map((tier: PaywallTier) => {
      const unlocksAll = tier.key === "all" || /全部|all/i.test(tier.label)
      return {
        key: tier.key,
        amount: tier.beansCost,
        description: unlocksAll
          ? t("payment.unlockAll", { count: paywall.remainingCount })
          : t("payment.unlockEpisodes", { count: tier.episodes }),
      }
    })
  }, [paywall, t])

  // Map API subscription plans -> presentational vip options.
  const vipOptions = useMemo<VipOption[]>(() => {
    if (!paywall?.subscriptionPlans) return []
    return paywall.subscriptionPlans.map((plan, index) => ({
      planId: plan.planId,
      period: plan.period,
      title: t(PERIOD_LABEL_KEYS[plan.period]),
      description: t(PERIOD_DESCRIPTION_KEYS[plan.period]),
      price: pickPrice(plan),
      theme: VIP_THEME_BY_PERIOD[plan.period],
      recommended: index === 0,
    }))
  }, [paywall, t])

  const handleBeansTier = async (option: BeansOption) => {
    setPayStep("processing")
    setProcessingTextKey("payment.creatingOrder")
    try {
      const order = await miniApi.createUnlockOrder(userId, dramaId, option.key)
      setOrderNo(order.orderNo)
      setPayStep("result")
    } catch (err) {
      console.error("Failed to create order:", err)
      setPayStep("select")
    }
  }

  const handleSubscription = async (option: VipOption) => {
    setPayStep("processing")
    setProcessingTextKey("payment.creatingOrder")
    try {
      const order = await miniApi.createSubscriptionOrder(userId, option.planId, dramaId)
      setOrderNo(order.orderNo)
      setPayStep("result")
    } catch (err) {
      console.error("Failed to create order:", err)
      setPayStep("select")
    }
  }

  const handlePayResult = async (success: boolean) => {
    setPayStep("processing")
    setProcessingTextKey(success ? "payment.processing" : "payment.cancelling")
    try {
      await miniApi.reportPayResult(orderNo, success)
      setPaySuccess(success)
      if (success) {
        setTimeout(() => onPaySuccess(), 1000)
      } else {
        setPayStep("select")
      }
    } catch (err) {
      console.error("Failed to report pay result:", err)
      setPayStep("select")
    }
  }

  const showSheet = !loading && payStep === "select" && !!paywall

  return (
    <div className="payment-overlay" onClick={onClose}>
      <div className="w-full" onClick={(e) => e.stopPropagation()}>
        {/* Loading */}
        {loading && (
          <div className="payment-sheet animate-slide-up flex items-center justify-center py-14">
            <Loader2 size={26} className="animate-spin text-white/50" />
          </div>
        )}

        {/* Selection sheet */}
        {showSheet && paywall && (
          <PaymentSheet
            beansPerEp={paywall.beansPerEp}
            beansOptions={beansOptions}
            vipOptions={vipOptions}
            onSelectBeans={handleBeansTier}
            onSelectVip={handleSubscription}
            onClose={onClose}
          />
        )}

        {/* Processing state */}
        {payStep === "processing" && (
          <div className="payment-sheet animate-slide-up flex flex-col items-center justify-center gap-3 py-14">
            {paySuccess ? (
              <>
                <CheckCircle size={48} className="text-green-400" />
                <span className="text-[17px] text-white">{t("payment.success")}</span>
              </>
            ) : (
              <>
                <Loader2 size={32} className="animate-spin text-white/50" />
                <span className="text-[16px] text-white/60">{t(processingTextKey)}</span>
              </>
            )}
          </div>
        )}

        {/* Demo: choose pay result */}
        {payStep === "result" && (
          <div
            className="payment-sheet animate-slide-up space-y-4 px-5 py-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
          >
            <p className="text-center text-[15px] text-white/50">{t("payment.demoResult")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handlePayResult(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-600/20 py-3.5 active:opacity-80"
              >
                <CheckCircle size={18} className="text-green-400" />
                <span className="text-[16px] font-medium text-green-400">
                  {t("payment.successResult")}
                </span>
              </button>
              <button
                onClick={() => handlePayResult(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-600/20 py-3.5 active:opacity-80"
              >
                <XCircle size={18} className="text-red-400" />
                <span className="text-[16px] font-medium text-red-400">
                  {t("payment.failedResult")}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
