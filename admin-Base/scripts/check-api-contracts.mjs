import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const api = readFileSync(new URL("../lib/api.ts", import.meta.url), "utf8")
const client = readFileSync(new URL("../lib/api-client.ts", import.meta.url), "utf8")

for (const name of ["authApi", "userApi", "roleApi", "appApi", "promotionLinkApi", "appUserApi", "dramaApi", "episodeApi", "uploadApi", "subscriptionApi", "paymentConfigApi", "rechargeOrderApi", "adSessionApi", "mediaEventReportApi"]) {
  assert.match(api, new RegExp(`export \\{[^}]*\\b${name}\\b`, "s"), `${name} must remain exported by the @/lib/api barrel`)
}
for (const path of ["/auth/login", "/users", "/roles", "/apps", "/promotion-links", "/app-users", "/dramas", "/subscription-plans", "/payment-configs", "/recharge-orders", "/ad-sessions", "/media-event-reports"]) {
  const domainFiles = ["auth", "users", "apps", "promotion", "dramas", "monetization", "operations"].map((name) => readFileSync(new URL(`../lib/api/${name}.ts`, import.meta.url), "utf8")).join("\n")
  assert.ok(domainFiles.includes(path), `${path} contract must remain present`)
}
assert.match(client, /XMLHttpRequest/, "progress uploads must keep XHR")
assert.match(client, /composeSignal/, "fetch requests must compose caller cancellation with timeout")
console.log("API compatibility checks passed")
