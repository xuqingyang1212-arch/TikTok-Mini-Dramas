import assert from "node:assert/strict"
import test from "node:test"
import { getHistoryView, shouldUseBrowserBack, syncHistoryView } from "../lib/app/navigation.ts"
import { readPromotionLaunchContext } from "../lib/app/promotion.ts"
import { parseStoredUser, USER_KEY } from "../lib/app/session.ts"

test("session parsing preserves the established storage contract", () => {
  assert.equal(USER_KEY, "mini_drama_user")
  assert.deepEqual(parseStoredUser('{"userId":"42","appName":"Demo","monetizationType":"IAA"}'), {
    userId: "42",
    appName: "Demo",
    monetizationType: "IAA",
  })
  assert.equal(parseStoredUser("not-json"), null)
  assert.equal(parseStoredUser('{"appName":"Demo"}'), null)
  assert.deepEqual(parseStoredUser('{"userId":"legacy"}'), { userId: "legacy" })
})

test("history state keeps main replacements and subview pushes", () => {
  const calls: Array<[string, unknown, string]> = []
  const history = {
    state: { view: "main" },
    pushState: (state: unknown, _title: string, url?: string | URL | null) => calls.push(["push", state, String(url)]),
    replaceState: (state: unknown, _title: string, url?: string | URL | null) => calls.push(["replace", state, String(url)]),
  }

  assert.equal(syncHistoryView(history, "/", "main"), "none")
  assert.equal(syncHistoryView(history, "/", "player"), "push")
  assert.deepEqual(calls, [["push", { view: "player" }, "/"]])
  assert.equal(getHistoryView({ view: "unknown" }), "main")
  assert.equal(shouldUseBrowserBack({ view: "player" }, "player"), true)
})

test("promotion launch parsing accepts only the documented casing", () => {
  assert.deepEqual(readPromotionLaunchContext("?dramaId=123&linkId=10000001"), {
    dramaId: "123",
    linkId: "10000001",
  })
  assert.deepEqual(readPromotionLaunchContext("?dramaId=123&LinkId=wrong"), {
    dramaId: "123",
    linkId: null,
  })
})
