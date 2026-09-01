"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { miniApi, type AdUnlockSession } from "@/lib/api"

const MIN_DEMO_DURATION_MS = 3_000
const MAX_DEMO_DURATION_MS = 15_000

type StartResult = "started" | "already-unlocked" | "ignored" | "failed"

interface UseRewardedAdUnlockOptions {
  userId: string
  dramaId: string
  episodeNo: number
  enabled: boolean
  onUnlocked: () => Promise<void>
}

export function useRewardedAdUnlock({
  userId,
  dramaId,
  episodeNo,
  enabled,
  onUnlocked,
}: UseRewardedAdUnlockOptions) {
  const [session, setSession] = useState<AdUnlockSession | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [isRewarded, setIsRewarded] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const requestControllerRef = useRef<AbortController | null>(null)
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineRef = useRef<number | null>(null)
  const remainingMsRef = useRef<number | null>(null)
  const completingRef = useRef(false)
  const startingRef = useRef(false)
  const mountedRef = useRef(true)
  const activeSessionRef = useRef<AdUnlockSession | null>(null)

  const clearTimers = useCallback(() => {
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current)
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
    completionTimerRef.current = null
    countdownTimerRef.current = null
    deadlineRef.current = null
  }, [])

  const clearRequestController = useCallback((controller: AbortController) => {
    if (requestControllerRef.current === controller) {
      requestControllerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearTimers()
    setSession(null)
    activeSessionRef.current = null
    setRemainingSeconds(null)
    setIsRewarded(false)
    setIsSubmitting(false)
    setShowCloseConfirm(false)
    remainingMsRef.current = null
    completingRef.current = false
  }, [clearTimers])

  const startCountdown = useCallback(() => {
    if (!session || isRewarded || completionTimerRef.current) return

    const duration = remainingMsRef.current ?? (
      MIN_DEMO_DURATION_MS + Math.floor(Math.random() * (MAX_DEMO_DURATION_MS - MIN_DEMO_DURATION_MS + 1))
    )
    remainingMsRef.current = duration
    deadlineRef.current = Date.now() + duration
    setRemainingSeconds(Math.ceil(duration / 1000))

    countdownTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, (deadlineRef.current ?? Date.now()) - Date.now())
      remainingMsRef.current = remaining
      setRemainingSeconds(Math.ceil(remaining / 1000))
      if (remaining <= 0 && countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
        countdownTimerRef.current = null
      }
    }, 250)

    completionTimerRef.current = setTimeout(() => {
      clearTimers()
      remainingMsRef.current = 0
      if (!mountedRef.current) return
      setRemainingSeconds(0)
      setIsRewarded(true)
    }, duration)
  }, [clearTimers, isRewarded, session])

  const pauseCountdown = useCallback(() => {
    if (deadlineRef.current !== null) {
      remainingMsRef.current = Math.max(0, deadlineRef.current - Date.now())
    }
    clearTimers()
  }, [clearTimers])

  const start = useCallback(async (): Promise<StartResult> => {
    if (!enabled || startingRef.current || session) return "ignored"

    startingRef.current = true
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setIsStarting(true)

    try {
      const nextSession = await miniApi.createAdUnlockSession(userId, dramaId, episodeNo, {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return "ignored"

      if (nextSession.isUnlocked) {
        await onUnlocked()
        return "already-unlocked"
      }

      setSession(nextSession)
      activeSessionRef.current = nextSession
      setRemainingSeconds(null)
      setIsRewarded(false)
      setShowCloseConfirm(false)
      remainingMsRef.current = null
      completingRef.current = false
      return "started"
    } catch (error) {
      if (!controller.signal.aborted) console.error("Failed to create ad unlock session:", error)
      return controller.signal.aborted ? "ignored" : "failed"
    } finally {
      startingRef.current = false
      clearRequestController(controller)
      if (mountedRef.current) setIsStarting(false)
    }
  }, [clearRequestController, dramaId, enabled, episodeNo, onUnlocked, session, userId])

  const startPlayback = useCallback(() => {
    if (!session || isRewarded || showCloseConfirm || isSubmitting) return
    startCountdown()
  }, [isRewarded, isSubmitting, session, showCloseConfirm, startCountdown])

  const pausePlayback = useCallback(() => {
    if (!session || isRewarded) return
    pauseCountdown()
  }, [isRewarded, pauseCountdown, session])

  const requestClose = useCallback(() => {
    if (!session || isSubmitting) return
    if (isRewarded) return
    pauseCountdown()
    setShowCloseConfirm(true)
  }, [isRewarded, isSubmitting, pauseCountdown, session])

  const continueWatching = useCallback(() => {
    setShowCloseConfirm(false)
  }, [])

  const cancel = useCallback(async () => {
    if (!session || isSubmitting) return

    pauseCountdown()
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setIsSubmitting(true)

    try {
      await miniApi.cancelAdUnlockSession(session.sessionNo, userId, { signal: controller.signal })
    } catch (error) {
      if (!controller.signal.aborted) console.error("Failed to cancel ad unlock session:", error)
    } finally {
      clearRequestController(controller)
      if (mountedRef.current) reset()
    }
  }, [clearRequestController, isSubmitting, pauseCountdown, reset, session, userId])

  const complete = useCallback(async () => {
    if (!session || !isRewarded || completingRef.current) return

    completingRef.current = true
    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setIsSubmitting(true)

    try {
      await miniApi.completeAdUnlockSession(session.sessionNo, userId, { signal: controller.signal })
      if (controller.signal.aborted || !mountedRef.current) return
      await onUnlocked()
      if (!controller.signal.aborted && mountedRef.current) reset()
    } catch (error) {
      if (controller.signal.aborted || !mountedRef.current) return
      console.error("Failed to complete ad unlock session:", error)
      completingRef.current = false
      setIsSubmitting(false)
    } finally {
      clearRequestController(controller)
    }
  }, [clearRequestController, isRewarded, onUnlocked, reset, session, userId])

  const close = useCallback(() => {
    if (isRewarded) {
      void complete()
      return
    }
    requestClose()
  }, [complete, isRewarded, requestClose])

  useEffect(() => {
    if (session && (session.dramaId !== dramaId || session.episodeNo !== episodeNo)) {
      void cancel()
    }
  }, [cancel, dramaId, episodeNo, session])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimers()
      requestControllerRef.current?.abort()

      const activeSession = activeSessionRef.current
      if (activeSession && !completingRef.current) {
        void miniApi.cancelAdUnlockSession(activeSession.sessionNo, userId, { keepalive: true }).catch(() => undefined)
      }
    }
  }, [clearTimers, userId])

  return {
    session,
    remainingSeconds,
    isRewarded,
    isStarting,
    isSubmitting,
    showCloseConfirm,
    start,
    close,
    cancel,
    continueWatching,
    startPlayback,
    pausePlayback,
  }
}
