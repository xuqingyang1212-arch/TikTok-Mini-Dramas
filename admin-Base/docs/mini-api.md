# TikTok 漫剧小程序 前端接口文档

> 演示项目，不实际调用 TikTok 官方支付、订阅和广告接口。IAP 模式由本系统演示「下单 -> 上报支付结果 -> 解锁」；IAA 模式由小程序模拟 TikTok 激励广告回调，并通过服务端广告会话完成永久单集解锁。

## 通用约定

- Base URL：`http://localhost:8080`，局域网 `http://10.235.120.10:8080`
- 所有接口无需后台登录鉴权。
- 统一响应结构：`{ "code": 0, "message": "success", "data": {...} }`，`code != 0` 为失败，`message` 为原因。
- 时间字段为 RFC3339 字符串（如 `2026-08-11T11:07:10+08:00`）。
- `userId` 为登录接口返回的雪花字符串，凡涉及“当前用户解锁状态”的接口都应带上，未带则按未登录（仅免费集）处理。

### 请求语言

所有 `/api/mini` 接口都可以统一携带标准请求头 `Accept-Language`。前端应把**小程序内当前选择的语言**写入该请求头，不要依赖系统或浏览器自动携带的默认语言。

| 小程序语言 | 推荐请求头 | 兼容值 |
| --- | --- | --- |
| 中文 | `Accept-Language: zh-CN` | `zh`、任意 `zh-*` |
| 英文 | `Accept-Language: en-US` | `en`、任意 `en-*` |

- 支持标准语言列表和权重，例如 `en-US,en;q=0.9,zh-CN;q=0.8`。
- 未传请求头，或没有匹配到 `zh` / `en` 时，默认语言为英文 `en-US`。
- 当前阶段服务端仅统一接收并解析语言，为后续多语言内容返回预留；**所有接口暂时都不按语言过滤数据，也不校验剧集语言**。
- 当前接口响应结构和业务逻辑保持不变。切换语言不会改变剧集列表，也不需要更换现有 `dramaId`。

请求示例：

```bash
curl -H 'Accept-Language: en-US' 'http://localhost:8080/api/mini/dramas?page=1&pageSize=10'
```

## 接口总览

| 分类 | 方法 | 路径 |
| --- | --- | --- |
| 小程序 | GET | `/api/mini/apps` |
| 登录 | POST | `/api/mini/auth/login` |
| 用户 | GET | `/api/mini/users/:userId` |
| 用户 | GET | `/api/mini/users/:userId/payment-records` |
| 剧集 | GET | `/api/mini/dramas` |
| 剧集 | GET | `/api/mini/dramas/:id` |
| 剧集 | GET | `/api/mini/dramas/:id/episodes` |
| 剧集 | GET | `/api/mini/dramas/:id/episodes/:episodeNo` |
| 解锁 | GET | `/api/mini/dramas/:id/unlock-status` |
| 观看 | POST | `/api/mini/watch-report` |
| 支付 | GET | `/api/mini/dramas/:id/paywall` |
| 支付 | POST | `/api/mini/orders/unlock` |
| 支付 | POST | `/api/mini/orders/subscription` |
| 支付 | POST | `/api/mini/orders/:orderNo/pay-result` |
| 广告解锁 | POST | `/api/mini/ad-unlock-sessions` |
| 广告解锁 | POST | `/api/mini/ad-unlock-sessions/:sessionNo/complete` |
| 广告解锁 | POST | `/api/mini/ad-unlock-sessions/:sessionNo/cancel` |

## 1. 获取可用小程序列表

`GET /api/mini/apps`

返回已启用的小程序。前端可用于登录前选择要进入的小程序，并根据变现类型决定后续使用 IAA 或 IAP 交互。一个小程序只会配置一种变现类型，不支持 IAA、IAP 混用。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "name": "BFDrama",
        "clientKey": "aw7x9k2m4p6q8r1t3v5y",
        "monetizationType": "IAA",
        "adPlacementId": "rewarded_video_xxx"
      }
    ]
  }
}
```

字段说明：

- `name`：小程序名称。
- `clientKey`：TikTok Client Key，登录接口的 `appId` 使用该值。
- `monetizationType`：变现类型，枚举 `IAA` / `IAP`。
  - `IAA`：激励广告解锁模式。
  - `IAP`：Beans 支付与会员订阅模式。
- `adPlacementId`：IAA 小程序的激励广告位 ID，后台未配置时返回空字符串；IAP 小程序固定返回空字符串。小程序使用该 ID 展示广告；当前演示项目不直接调用 TikTok 广告接口。

## 2. 用户登录 / 注册

`POST /api/mini/auth/login`

`openId + 小程序` 存在则返回已有用户，否则创建新用户。登录同时返回该用户当前会员状态。

请求体：

```json
{ "appId": "aw7x9k2m4p6q8r1t3v5y", "openId": "user_openid_xxx" }
```

- `appId`：即小程序的 TikTok Client Key（取自接口 1 的 `clientKey`）。
- `openId`：小程序侧的用户唯一标识，字符串即可，无固定格式。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "359925045662846976",
    "isNew": true,
    "subscription": {
      "active": true,
      "period": "weekly",
      "expireAt": "2026-08-11T11:07:10+08:00"
    }
  }
}
```

`subscription` 为当前用户会员状态：

- `active`：是否在有效会员周期内。`false` 时 `period`、`expireAt` 为空。
- `period`：订阅周期，`weekly` / `monthly` / `quarterly` / `half_yearly` / `yearly`。
- `expireAt`：会员到期时间。

## 2.1 获取用户信息

`GET /api/mini/users/:userId`

纯查询接口，返回用户信息及**当前会员状态**。用于个人中心刷新会员信息，无需重复调用登录接口。订阅成功后调用即可拿到最新会员状态。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": "359928825716412416",
    "openId": "user_openid_xxx",
    "appName": "BFDrama",
    "clientKey": "aw7x9k2m4p6q8r1t3v5y",
    "createdAt": "2026-08-04T11:21:59+08:00",
    "subscription": {
      "active": true,
      "period": "weekly",
      "expireAt": "2026-08-11T11:22:09+08:00"
    }
  }
}
```

- `subscription` 字段含义同登录接口。
- 用户不存在时返回 `code=400`，`message="用户不存在"`。

## 3. 剧集列表

`GET /api/mini/dramas?page=1&pageSize=10`

返回全部已上架剧集，按创建时间倒序。当前 `Accept-Language` 不参与列表过滤。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "359640592935817216",
        "name": "菜摊大妈竟是广场舞战术大师",
        "coverUrl": "/media/images/2026/08/03/xxx.jpg",
        "language": "中文",
        "episodeCount": 26,
        "paywallEpisode": 11
      }
    ],
    "total": 12
  }
}
```

- `coverUrl`：相对路径，前端拼 Base URL 访问（如 `http://localhost:8080/media/...`）。
- `paywallEpisode`：付费卡点集数，`< paywallEpisode` 的集免费。

## 4. 剧集详情

`GET /api/mini/dramas/:id`

响应 `data` 同列表单项结构：`id` / `name` / `coverUrl` / `language` / `episodeCount` / `paywallEpisode`。当前不校验请求语言与剧集语言是否一致。

## 5. 单集列表

`GET /api/mini/dramas/:id/episodes?userId={userId}`

返回该剧全部单集及当前用户的解锁情况。当前不校验请求语言与剧集语言是否一致。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "episodeNo": 1,
        "videoUrl": "/media/videos/2026/08/03/xxx.mp4",
        "duration": 92,
        "isFree": true,
        "isUnlocked": true,
        "unlockType": "free",
        "canUnlockByAd": false
      }
    ],
    "total": 26,
    "paywallEpisode": 11
  }
}
```

- `unlockType`：`free` / `beans` / `subscription` / `ad` / `locked`，含义见接口 7。
- `canUnlockByAd`：仅当该集未解锁、所属小程序为 IAA 且已配置广告位时为 `true`。
- `videoUrl`：仅已解锁集返回真实地址；未解锁集固定返回空字符串 `""`。当前 `/media` 仍是公开静态目录，正式环境还需签名 URL 或受保护的媒体代理。

## 6. 单集播放信息

`GET /api/mini/dramas/:id/episodes/:episodeNo?userId={userId}`

返回单集详情，字段同接口 5 的单项。用于按需拉取指定集的播放信息。当前不校验请求语言与剧集语言是否一致。

## 7. 剧集逐集解锁详情（当前用户）

`GET /api/mini/dramas/:id/unlock-status?userId={userId}`

返回当前用户在这部剧的每一集解锁状态与解锁来源。用于剧集详情页展示“哪些免费、哪些已购、哪些会员解锁、哪些未解锁”。当前不校验请求语言与剧集语言是否一致。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dramaId": "358554131406786560",
    "episodeCount": 9,
    "paywallEpisode": 2,
    "bySubscription": true,
    "unlockedCount": 9,
    "remainingCount": 0,
    "episodes": [
      { "episodeNo": 1, "videoUrl": "...", "duration": 90, "isFree": true,  "isUnlocked": true,  "unlockType": "free",         "canUnlockByAd": false },
      { "episodeNo": 2, "videoUrl": "...", "duration": 90, "isFree": false, "isUnlocked": true,  "unlockType": "beans",        "canUnlockByAd": false },
      { "episodeNo": 7, "videoUrl": "...", "duration": 90, "isFree": false, "isUnlocked": true,  "unlockType": "subscription", "canUnlockByAd": false },
      { "episodeNo": 8, "videoUrl": "...", "duration": 90, "isFree": false, "isUnlocked": true,  "unlockType": "ad",           "canUnlockByAd": false },
      { "episodeNo": 9, "videoUrl": "",    "duration": 90, "isFree": false, "isUnlocked": false, "unlockType": "locked",       "canUnlockByAd": true }
    ]
  }
}
```

`unlockType` 取值与优先级：

- `free`：免费集（`episodeNo < paywallEpisode`）。
- `beans`：用户用 Beans 购买解锁的集，**永久有效**。
- `ad`：用户完整观看激励广告后永久解锁的集。
- `subscription`：由有效会员解锁的集。会员到期后这些集会重新变回 `locked`（若没有永久权益）。
- `locked`：未解锁。

说明：

- 永久权益（`beans` / `ad`）优先于订阅权益。
- `bySubscription`：`true` 表示 IAP 用户当前有有效会员；IAA 用户固定为 `false`。
- `canUnlockByAd`：锁定集是否可以创建广告解锁会话。

## 8. IAA 激励广告解锁

IAA 应用每完整观看一次广告永久解锁一集。广告会话有效期为 10 分钟；同一用户、应用、剧集和集数在同一时刻只会有一个有效 `pending` 会话。

### 8.1 创建广告解锁会话

`POST /api/mini/ad-unlock-sessions`

请求体：

```json
{ "userId": "359916...", "dramaId": "358554131406786560", "episodeNo": 3 }
```

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sessionNo": "AD9F3A...",
    "status": "pending",
    "dramaId": "358554131406786560",
    "episodeNo": 3,
    "adPlacementId": "rewarded_video_xxx",
    "expireAt": "2026-08-27T15:30:00+08:00",
    "unlockType": "locked",
    "isUnlocked": false
  }
}
```

- 已有有效会话时会复用同一会话。
- 目标集已经解锁时返回 `status="already_unlocked"`、`isUnlocked=true`，不创建会话。
- 免费集也属于已解锁，不需要展示广告。

### 8.2 完成广告观看

`POST /api/mini/ad-unlock-sessions/:sessionNo/complete`

请求体：

```json
{ "userId": "359916..." }
```

只有 TikTok 前端 `onClose({ isEnded })` 中 `isEnded === true` 时才调用。服务端校验会话归属后，以事务完成会话并写入永久权益。成功响应中的 `status` 为 `completed`、`unlockType` 为最终真实权益来源、`isUnlocked=true`。重复完成会幂等返回当前结果。

### 8.3 取消广告会话

`POST /api/mini/ad-unlock-sessions/:sessionNo/cancel`

请求体：

```json
{ "userId": "359916..." }
```

广告加载失败、中途关闭或 `isEnded !== true` 时可以调用。成功响应 `status="canceled"`、`isUnlocked=false`；取消不发放权益。`completed`、`canceled`、`expired` 均为终态。

完成和取消接口都必须传当前 `userId`。服务端只以会话保存的应用、剧集和集数作为发放依据，不接受前端重新指定目标。

## 9. 付费面板

`GET /api/mini/dramas/:id/paywall?userId={userId}&appId={appId}&currentEpisode={currentEpisode}`

返回该用户在这部剧可购买的 Beans 档位与订阅档位。**档位由后端计算**（解锁可能是剧中部分集）。

- `userId`（可选）：已登录时传入，用于计算解锁进度与会员状态，且优先以该用户所属小程序为准。
- `appId`（可选）：小程序主键 ID。**未登录时必须传入**，否则无法计算 IAP 配置。登录后可省略（以用户所属小程序为准）。
- `currentEpisode`（可选，默认 `1`）：用户当前所在集。Beans 档位仅统计从该集到剧终之间仍未解锁的集数。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dramaId": "358554131406786560",
    "totalEpisodes": 9,
    "paywallEpisode": 2,
    "beansPerEp": 100,
    "unlockedCount": 1,
    "remainingCount": 8,
    "hasSubscription": false,
    "tiers": [
      { "key": "next5", "label": "后续5集", "episodes": 5, "beansCost": 500 },
      { "key": "all",   "label": "解锁全部", "episodes": 8, "beansCost": 800 }
    ],
    "subscriptionPlans": [
      { "planId": "359968243282087936", "period": "weekly",  "applePrice": 9.99,   "googlePrice": 6.99,   "webDiscount": 0, "tierId": "weekly_pass" },
      { "planId": "359968344935239680", "period": "monthly", "applePrice": 38.88,  "googlePrice": 36.88,  "webDiscount": 0, "tierId": "monthly_pass" },
      { "planId": "359968577064800256", "period": "yearly",  "applePrice": 189.99, "googlePrice": 168.88, "webDiscount": 0, "tierId": "annual_pass" }
    ]
  }
}
```

- `beansPerEp`：每集消耗 Beans（当前全平台固定 100，后端可配置）。
- `tiers` 档位规则（后端判定）：
  - `next5` / `next10` / `next20`：仅当从 `currentEpisode` 到剧终的未解锁集数 **大于** 该档位数量时才返回。
  - `all`：只要该范围内还有未解锁集就返回，`episodes` = 范围内剩余全部集数。
  - `beansCost` = `episodes` × `beansPerEp`。
- `hasSubscription=true` 时前端可不展示付费面板（全部可看）。
- `subscriptionPlans`：该小程序配置的订阅档位。

## 10. 创建 Beans 解锁订单

`POST /api/mini/orders/unlock`

请求体：

```json
{ "userId": "359916...", "dramaId": "358554131406786560", "tierKey": "next5", "deviceOs": "Apple", "currentEpisode": 20 }
```

- `tierKey` 取自接口 9 的 `tiers[].key`。
- `currentEpisode` 传入打开付费面板时的当前集；服务端只从该集到剧终选择仍未解锁的集数。
- `deviceOs` 选填，取值 `Apple` / `Google`（用户下单设备系统），缺省按 `Apple` 记录，用于后台充值订单展示。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "orderNo": "342874772350697472",
    "orderType": "unlock",
    "payStatus": "pending",
    "beansCost": 500,
    "episodes": [2, 3, 4, 5, 6]
  }
}
```

`episodes` 为本单支付成功后会解锁的集号。`orderNo` 为纯雪花订单号（字符串），示例 `342874772350697472`。

## 11. 创建订阅订单

`POST /api/mini/orders/subscription`

请求体：

```json
{ "userId": "359916...", "planId": "359899754022309888", "dramaId": "358554131406786560", "deviceOs": "Apple" }
```

- `planId` 取自接口 9 的 `subscriptionPlans[].planId`。
- `dramaId` 选填，表示用户下单时所在剧集（从剧集内触发订阅时传；从个人中心直接开会员可不传或传 0）。仅用于后台充值订单展示“充值剧集”。
- `deviceOs` 选填，取值 `Apple` / `Google`，缺省按 `Apple` 记录。

响应 `data`：`{ "orderNo": "342874772350697472", "orderType": "subscription", "payStatus": "pending" }`。

## 12. 上报支付结果（演示用）

`POST /api/mini/orders/:orderNo/pay-result`

请求体：

```json
{ "success": true }
```

- `success: true`：立即执行解锁 / 开通订阅。
- `success: false`：订单标记为 `failed`（终态）。

成功（解锁单）响应：

```json
{
  "code": 0,
  "message": "success",
  "data": { "orderNo": "342874772350697472", "payStatus": "paid", "unlocked": [2, 3, 4, 5, 6] }
}
```

成功（订阅单）响应 `data`：`{ "orderNo": "...", "payStatus": "paid" }`（无 `unlocked`）。

失败响应 `data`：`{ "orderNo": "...", "payStatus": "failed" }`。

> 说明：支付成功后，后端会自动为订单回填第三方（TikTok）订单号 `thirdPartyOrderNo`（演示格式 `TOID{毫秒时间戳}`，如 `TOID1732533244259`），在后台【充值订单】页可见。

## 13. 用户支付记录（订阅 + Beans 解锁）

`GET /api/mini/users/:userId/payment-records`

返回该用户**支付成功**的订阅记录与 Beans 解锁记录。仅统计 `payStatus=paid` 的订单，`pending`（待支付）/ `failed`（失败）/ `cancelled`（取消）均不返回。两个列表均按支付时间倒序排列。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "subscriptions": [
      {
        "orderNo": "360291049882521601",
        "period": "weekly",
        "amount": 6.99,
        "deviceOs": "Google",
        "paidAt": "2026-08-05 11:21:20"
      }
    ],
    "unlocks": [
      {
        "orderNo": "360290985516732417",
        "dramaId": "358554131406786560",
        "dramaName": "丹烬二十秋",
        "unlockCount": 5,
        "episodes": [2, 3, 4, 5, 6],
        "beansCost": 500,
        "paidAt": "2026-08-05 11:21:04"
      }
    ]
  }
}
```

订阅记录 `subscriptions[]`：
- `period`：订阅周期，枚举 `weekly` / `monthly` / `quarterly` / `half_yearly` / `yearly`。
- `amount`：实际支付金额，按下单时的设备系统取对应价格（`deviceOs=Google` 取 Google 价，否则取 Apple 价）。
- `deviceOs`：下单设备系统，`Apple` / `Google`。
- `paidAt`：支付时间，格式 `2006-01-02 15:04:05`。

Beans 解锁记录 `unlocks[]`：
- `dramaId` / `dramaName`：解锁的剧集 ID 与名称。
- `unlockCount`：本单解锁的集数数量。
- `episodes`：本单解锁的具体集数序号数组。
- `beansCost`：本单支付的 Beans 数量。
- `paidAt`：支付时间，格式同上。

- 用户不存在时返回 `code=400`，`message="用户不存在"`。
- 无任何支付成功记录时，两个列表均返回空数组 `[]`。

## 14. 观看上报

`POST /api/mini/watch-report`

用户在某部剧的某一集**开始播放**时调用，记录一条观看日志。

请求体：

```json
{ "userId": "360290985235714048", "dramaId": "358554131406786560", "episodeNo": 3 }
```

- `userId` / `dramaId`：雪花字符串。
- `episodeNo`：集数序号（从 1 开始）。

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "logId": "360301247556751360",
    "dramaId": "358554131406786560",
    "episodeNo": 3,
    "unlockType": "beans",
    "watchedAt": "2026-08-05 12:01:51"
  }
}
```

- `unlockType`：**解锁方式由服务端判定**，前端无需上报。枚举：
  - `free`：免费集（`episodeNo < paywallEpisode`）。
  - `beans`：该集已用 Beans 购买解锁。
  - `ad`：该集已通过完整观看激励广告永久解锁。
  - `subscription`：会员有效期内解锁（且该集没有永久权益）。
- `watchedAt`：**服务端收到本次上报请求时的时间**（即“开始播放”时刻的近似值，取自服务端 `time.Now()`），格式 `2006-01-02 15:04:05`。与前端真实点击播放时刻之间存在网络延迟；如需以前端时刻为准，可另行约定由前端传入时间戳。
- 只上报**已解锁**的集（`free` / `beans` / `ad` / `subscription`）。未解锁的集调用本接口会返回 `code=400`，`message="该集尚未解锁，不上报"`，且不落库。
- 同一集每次开播都会各记一条（不去重），前端无需去重。
- 错误：该集未解锁 `code=400`；用户不存在 `code=400`；剧集不存在或已下架 `code=404`；集数越界/不存在 `code=404`。

> 关于解锁方式为什么由服务端判定：`beans`、`ad` 与 `subscription` 的判定依赖 `user_unlocks` / `user_subscriptions` 表的真实数据，前端上报既冗余又不可信。判定规则与「剧集逐集解锁详情」完全一致：永久权益优先于订阅权益。

## IAA / IAP 接口互斥

服务端会根据用户所属小程序执行最终校验：

- IAA 应用只能使用广告解锁接口；调用付费面板、Beans 下单、订阅下单或支付结果接口会被拒绝。
- IAP 应用只能使用 Beans/订阅流程；调用广告解锁接口会被拒绝。
- 已存在支付订单、订阅、永久权益或广告会话的应用，后台不允许直接切换变现类型，避免已有业务数据失去一致性。

前端隐藏入口仅用于改善交互，不能替代服务端校验。

## 支付状态与终态定义（重要）

订单支付状态共 3 个，成功与失败都是终态：

1. **待支付（pending）**：点击档位即创建新订单，状态为待支付。每次点击都创建新订单；未收到支付结果前一直是待支付。
2. **支付成功（paid，终态）**：用户完成支付，执行解锁 / 开通订阅。
3. **支付失败（failed，终态）**：订单支付失败，**不能再变为成功**。

对已处于终态（`paid` / `failed` / `cancelled`）的订单重复上报，会幂等返回当前状态，不会二次解锁、也不会改变结果。

**用户想重试支付：必须重新点击档位创建新订单**，不能对已失败订单再上报成功。

## 典型前端流程

1. 拉取小程序列表（接口 1），读取 `monetizationType` 后登录（接口 2），取得 `userId`。
2. 获取剧集列表，并用逐集解锁详情（接口 7）渲染当前状态。
3. 用户点击 `locked` 集时按变现类型分流：
   - `IAA`：创建广告会话（接口 8.1）并使用响应中的 `adPlacementId` 展示激励广告。只有 `onClose({ isEnded })` 的 `isEnded === true` 才调用完成接口（接口 8.2）；否则可调用取消接口（接口 8.3）。完成后刷新接口 7，再请求单集播放信息。
   - `IAP`：调用付费面板（接口 9），选择 Beans 档位创建订单（接口 10）或选择订阅方案创建订单（接口 11），随后上报支付结果（接口 12）。成功后刷新接口 7 / 9。
4. 开始播放时调用观看上报（接口 14）；解锁来源由服务端判定。
5. 订阅成功后，个人中心调用 `GET /api/mini/users/:userId` 刷新会员状态，不要重复登录。
6. 支付失败必须重新下单；广告会话取消或过期必须重新创建。
