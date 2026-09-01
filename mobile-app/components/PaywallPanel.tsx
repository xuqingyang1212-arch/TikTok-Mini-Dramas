"use client"

import { useEffect, useMemo, useReducer, useRef } from "react"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import {
  getDevicePrice,
  miniApi,
  type PaywallData,
  type PaywallTier,
  type SubscriptionPlan,
} from "@/lib/api"
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

type PaywallScreen = "loading" | "select" | "submitting" | "result" | "processing" | "success" | "error"

type PaywallState = {
  step: PaywallScreen
  paywall: PaywallData | null
  orderNo: string
  processingTextKey: TranslationKey
  error: string | null
}

type PaywallAction =
  | { type: "load" }
  | { type: "load_success"; paywall: PaywallData }
  | { type: "load_error"; message: string }
  | { type: "submit_start"; processingTextKey: TranslationKey }
  | { type: "submit_success"; orderNo: string }
  | { type: "submit_error"; message: string }
  | { type: "result_start"; success: boolean }
  | { type: "result_success"; success: boolean }
  | { type: "result_error"; message: string }
  | { type: "retry" }
  | { type: "reset_to_select" }

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

const VIP_THEME_BY_PERIOD: Record<SubscriptionPlan["period"], VipTheme> = {
  weekly: "gold",
  monthly: "purple",
  quarterly: "blue",
  half_yearly: "rose",
  yearly: "teal",
}

const initialState: PaywallState = {
  step: "loading",
  paywall: null,
  orderNo: "",
  processingTextKey: "payment.creatingOrder",
  error: null,
}

function paywallReducer(state: PaywallState, action: PaywallAction): PaywallState {
  switch (action.type) {
    case "load":
      return { ...initialState, step: "loading" }
    case "load_success":
      return { ...initialState, step: "select", paywall: action.paywall }
    case "load_error":
      return { ...initialState, step: "error", error: action.message }
    case "submit_start":
      return { ...state, step: "submitting", error: null, processingTextKey: action.processingTextKey }
    case "submit_success":
      return { ...state, step: "result", orderNo: action.orderNo, error: null }
    case "submit_error":
      return { ...state, step: "error", error: action.message }
    case "result_start":
      return {
        ...state,
        step: "processing",
        processingTextKey: action.success ? "payment.processing" : "payment.cancelling",
        error: null,
      }
    case "result_success":
      return {
        ...state,
        step: action.success ? "success" : "select",
        error: null,
      }
    case "result_error":
      return { ...state, step: "error", error: action.message }
    case "retry":
      return { ...initialState, step: "loading" }
    case "reset_to_select":
      return { ...state, step: "select", error: null }
    default:
      return state
  }
}

export function PaywallPanel({
  dramaId,
  userId,
  currentEpisode,
  onClose,
  onPaySuccess,
  appId,
}: PaywallPanelProps) {
  const { t } = useI18n()
  const [state, dispatch] = useReducer(paywallReducer, initialState)
  const loadAbortRef = useRef<AbortController | null>(null)
  const submitAbortRef = useRef<AbortController | null>(null)
  const resultAbortRef = useRef<AbortController | null>(null)
  const successTimerRef = useRef<number | null>(null)

  const loadPaywall = async () => {
    loadAbortRef.current?.abort()
    const controller = new AbortController()
    loadAbortRef.current = controller
    dispatch({ type: "load" })

    try {
      const data = await miniApi.getPaywall(dramaId, userId, appId, currentEpisode, { signal: controller.signal })
      if (!controller.signal.aborted) {
        dispatch({ type: "load_success", paywall: data })
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : "Failed to load paywall"
      dispatch({ type: "load_error", message })
    }
  }

  useEffect(() => {
    void loadPaywall()
    return () => {
      loadAbortRef.current?.abort()
      submitAbortRef.current?.abort()
      resultAbortRef.current?.abort()
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current)
      }
    }
  }, [dramaId, userId, appId, currentEpisode])

  const beansOptions = useMemo<BeansOption[]>(() => {
    if (!state.paywall) return []
    return state.paywall.tiers.map((tier: PaywallTier) => {
      const unlocksAll = tier.key === "all" || /全部|all/i.test(tier.label)
      return {
        key: tier.key,
        amount: tier.beansCost,
        description: unlocksAll
          ? t("payment.unlockAll", { count: state.paywall!.remainingCount })
          : t("payment.unlockEpisodes", { count: tier.episodes }),
      }
    })
  }, [state.paywall, t])

  const vipOptions = useMemo<VipOption[]>(() => {
    if (!state.paywall?.subscriptionPlans) return []
    return state.paywall.subscriptionPlans.map((plan, index) => ({
      planId: plan.planId,
      period: plan.period,
      title: t(PERIOD_LABEL_KEYS[plan.period]),
      description: t(PERIOD_DESCRIPTION_KEYS[plan.period]),
      price: getDevicePrice(plan),
      theme: VIP_THEME_BY_PERIOD[plan.period],
      recommended: index === 0,
    }))
  }, [state.paywall, t])

  const handleBeansTier = async (option: BeansOption) => {
    if (state.step === "submitting" || state.step === "processing" || state.step === "result" || state.step === "success") return
    const controller = new AbortController()
    submitAbortRef.current?.abort()
    submitAbortRef.current = controller
    dispatch({ type: "submit_start", processingTextKey: "payment.creatingOrder" })

    try {
      const order = await miniApi.createUnlockOrder(userId, dramaId, option.key, currentEpisode, { signal: controller.signal })
      if (controller.signal.aborted) return
      dispatch({ type: "submit_success", orderNo: order.orderNo })
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : "Failed to create order"
      dispatch({ type: "submit_error", message })
    }
  }

  const handleSubscription = async (option: VipOption) => {
    if (state.step === "submitting" || state.step === "processing" || state.step === "result" || state.step === "success") return
    const controller = new AbortController()
    submitAbortRef.current?.abort()
    submitAbortRef.current = controller
    dispatch({ type: "submit_start", processingTextKey: "payment.creatingOrder" })

    try {
      const order = await miniApi.createSubscriptionOrder(userId, option.planId, dramaId, { signal: controller.signal })
      if (controller.signal.aborted) return
      dispatch({ type: "submit_success", orderNo: order.orderNo })
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : "Failed to create order"
      dispatch({ type: "submit_error", message })
    }
  }

  const handlePayResult = async (success: boolean) => {
    if (state.step === "processing" || !state.orderNo) return

    const controller = new AbortController()
    resultAbortRef.current?.abort()
    resultAbortRef.current = controller
    dispatch({ type: "result_start", success })

    try {
      await miniApi.reportPayResult(state.orderNo, success, { signal: controller.signal })
      if (controller.signal.aborted) return
      dispatch({ type: "result_success", success })
      if (success) {
        if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
        successTimerRef.current = window.setTimeout(() => onPaySuccess(), 1000)
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : "Failed to report pay result"
      dispatch({ type: "result_error", message })
    }
  }

  const closeDisabled = state.step === "submitting" || state.step === "processing" || state.step === "result" || state.step === "success"

  return (
    <div className="payment-overlay" onClick={closeDisabled ? undefined : onClose}>
      <div className="w-full" onClick={(e) => e.stopPropagation()}>
        {state.step === "loading" && (
          <div className="payment-sheet animate-slide-up flex items-center justify-center py-14">
            <Loader2 size={26} className="animate-spin text-white/50" />
          </div>
        )}

        {state.step === "error" && (
          <div className="payment-sheet animate-slide-up flex flex-col items-center justify-center gap-4 px-5 py-12 text-center">
            <XCircle size={42} className="text-red-400" />
            <div className="space-y-1">
              <p className="text-[18px] font-semibold text-white">{t("purchase.loadFailed")}</p>
              <p className="text-[14px] text-white/60">{state.error || t("purchase.loadFailedDescription")}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadPaywall()}
              className="rounded-full bg-[#ff8a34] px-5 py-2.5 text-[15px] font-semibold text-white active:bg-[#f47c24]"
            >
              {t("purchase.reload")}
            </button>
          </div>
        )}

        {state.step === "select" && state.paywall && (
          <PaymentSheet
            beansPerEp={state.paywall.beansPerEp}
            beansOptions={beansOptions}
            vipOptions={vipOptions}
            onSelectBeans={handleBeansTier}
            onSelectVip={handleSubscription}
            onClose={onClose}
            closeDisabled={closeDisabled}
          />
        )}

        {state.step === "submitting" && (
          <div className="payment-sheet animate-slide-up flex flex-col items-center justify-center gap-3 py-14">
            <Loader2 size={32} className="animate-spin text-white/50" />
            <span className="text-[16px] text-white/60">{t(state.processingTextKey)}</span>
          </div>
        )}

        {state.step === "result" && (
          <div
            className="payment-sheet animate-slide-up space-y-4 px-5 py-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
          >
            <p className="text-center text-[15px] text-white/50">{t("payment.demoResult")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => void handlePayResult(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/40 bg-green-600/20 py-3.5 active:opacity-80"
              >
                <CheckCircle size={18} className="text-green-400" />
                <span className="text-[16px] font-medium text-green-400">{t("payment.successResult")}</span>
              </button>
              <button
                onClick={() => void handlePayResult(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-600/20 py-3.5 active:opacity-80"
              >
                <XCircle size={18} className="text-red-400" />
                <span className="text-[16px] font-medium text-red-400">{t("payment.failedResult")}</span>
              </button>
            </div>
          </div>
        )}

        {state.step === "processing" && (
          <div className="payment-sheet animate-slide-up flex flex-col items-center justify-center gap-3 py-14">
            {state.step === "processing" && (
              <>
                <Loader2 size={32} className="animate-spin text-white/50" />
                <span className="text-[16px] text-white/60">{t(state.processingTextKey)}</span>
              </>
            )}
          </div>
        )}

        {state.step === "success" && (
          <div className="payment-sheet animate-slide-up flex flex-col items-center justify-center gap-3 py-14">
            <CheckCircle size={48} className="text-green-400" />
            <span className="text-[17px] text-white">{t("payment.success")}</span>
          </div>
        )}
      </div>
    </div>
  )
}
