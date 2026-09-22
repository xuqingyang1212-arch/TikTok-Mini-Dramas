export type AppView = "main" | "player" | "purchase-records"

export interface AppHistoryState {
  view?: AppView
}

export function getHistoryView(state: unknown): AppView {
  if (!state || typeof state !== "object") return "main"

  const view = (state as AppHistoryState).view
  return view === "player" || view === "purchase-records" ? view : "main"
}

export function syncHistoryView(
  history: Pick<History, "state" | "pushState" | "replaceState">,
  pathname: string,
  view: AppView,
): "none" | "push" | "replace" {
  if (getHistoryView(history.state) === view) return "none"

  if (view === "main") {
    history.replaceState({ view: "main" }, "", pathname)
    return "replace"
  }

  history.pushState({ view }, "", pathname)
  return "push"
}

export function shouldUseBrowserBack(state: unknown, view: AppView): boolean {
  return view !== "main" && getHistoryView(state) === view
}
