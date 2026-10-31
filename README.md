# BUAA ClassHopper Web

移动端课表查询、即时签到、公告和广告。React + TypeScript + React Router + TanStack Query，UI 使用 shadcn/ui、Tailwind CSS 与 Radix Colors。Web 直接展示 iclass-service 已合并的课表，不额外合并连续课程。

## 本地运行

使用 Node **22.x**，本地已在 22.23.0 验证。推荐 `nvm use`。

```sh
npm ci
cp .env.example .env.development.local
# 填写现有 BUAA ClassHopper 公共 client ID
npm run dev
```

默认地址 `http://127.0.0.1:5180`。Vite 的本地同源代理将用户 API 转发到本地 API Platform `http://127.0.0.1:5173`；请同时启动该服务，并按 API Platform 的 `docs/classhopper-web.md` 设置测试 iClass 服务、KV 和服务调用 HMAC 密钥；授权与签到租约均使用现有 KV，不需要新增数据库迁移。

开发环境默认使用测试 SSO；Web client 必须配置 audience `api-platform-buaa-classhopper`，同时精确登记 Web 的 `/oauth/callback` 回调。保留 Android 原有回调；公共 client 不设置 secret。

| 环境变量                | 用途                                             |
| ----------------------- | ------------------------------------------------ |
| `SSO_ISSUER`            | 固定 SSO 源地址，必须 HTTPS，不含路径和凭据      |
| `SSO_CLIENT_ID`         | 与 Android 复用的公共 OAuth client ID            |
| `API_PLATFORM_BASE_URL` | 固定 API Platform 源地址；本地允许 loopback HTTP |

生产配置由 Vercel Function 的 `/app-config` 在运行时返回公开的 issuer 和 client ID，浏览器不读取服务端密钥。`/oauth/token`、`/oauth/userinfo` 和允许的 `/api/buaa-classhopper/...` 请求通过固定目标代理；不提供任意 URL、管理 API 或登录 Cookie 转发。公告和广告代理明确移除 Authorization 和 Cookie。

## 路由和业务

- `/`：系统宣传首页，提供网页版入口与 Android 下载，不依赖登录服务配置。
- `/privacy-and-terms`：供 App 内置浏览器打开的用户协议与隐私页面，无需登录，不请求 `/app-config` 或初始化 SSO，支持系统深浅色与手机安全区。正文和联系方式维护在 `src/pages/privacy-and-terms.tsx`。
- `/app`、`/app/schedule`：跳转到北京时间当天。
- `/app/schedule/:date`：周历与当日课表；选择日期保存在 URL。
- `/app/schedule/:date/:courseScheduleId`：课程详情和签到，支持直接打开、刷新与返回原日期。
- `/app/announcements`、`/app/announcements/:id`：匿名公告列表与 Markdown 详情。
- `/app/account`：SSO 账号、iClass 授权状态和退出登录。
- `/app/login`：自动前往 SSO，登录后返回 `/app` 内的原页面。
- `/oauth/callback`：保留已登记的 PKCE 回调地址，完成一次性回调校验。

首页图片集中维护在 `src/pages/home.tsx` 的 `homeImages`：`hero` 使用 Android 首页截图，`reservation` 使用预约签到截图，原图保存在 `public/images/`；`schedule` 暂留 4:3 空白画框。填入 `src` 和原图 `width`、`height` 即可展示，截图按原始比例完整显示，不裁切。未填写时不请求图片。Android 下载地址由同文件的 `androidDownloadUrl` 维护。

登录需要浏览器支持 Web Crypto、Web Locks、localStorage 和 sessionStorage，跨标签页状态通过 BroadcastChannel 同步。Access Token 只放内存；Refresh Token 存在 `classhopper.session.v1`，会串行轮换；state、PKCE verifier 和站内返回地址只放 sessionStorage。明确拒绝刷新时退出，网络故障保留 Refresh Token。点击退出登录时先清除本站凭据和用户缓存，再前往 SSO 的 `/logout` 页面；用户在 SSO 确认退出后，由 SSO 注销全局会话。此流程与 Android 版一致，不撤销 iClass 授权。

App 必须在用户明确授权后调用 API Platform 的 `PUT /api/buaa-classhopper/v1/iclass/authorization`，body 为 `{ loginName }`，身份取 SSO JWT sub。Web 不提供输入 loginName 的入口。授权凭据在 **API Platform KV 内直接保存**，不会返回 Web；KV 更新与撤销存在跨节点传播延迟。

签到前由 API Platform 再次核对该用户对应日期的课表。正常签到时段为北京时间课前 10 分钟到课程结束，时段外需要用户确认后尝试；结果不明先刷新课表，不自动重放 POST。

## 广告

在 API Platform 的 `buaa-classhopper` 下创建 `web-schedule-banner`，格式为 `banner`，并配置素材、活动与投放。页面取第一条投放展示在周历下方，无数据、接口失败或图片失败时不占位。不添加开屏或埋点。图片与目标链接仅使用 HTTP/HTTPS，不执行 App scheme 或危险协议。

## 验证与构建

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` 生成 `dist/` 静态资源，公告模块按需加载。Vercel 部署时另行构建 `api/gateway.ts`，运行在 Node.js 22；该函数与 Vite 本地代理共用 `server/proxy.ts`。`npm run preview` 在本地预览静态产物，并通过 Node HTTP 代理处理同源 API，不模拟完整 Vercel 路由平台。生产 CSP 限制脚本与请求为同源，并禁止嵌入；开发模式放行 Vite 自身的预处理脚本。

组件和单元测试使用模拟 SSO、上游课表及签到响应，不会提交真实签到。浏览器验收包含 320、375、390、430px 布局；验证记录见 `docs/verification.md`。浏览器截图位于忽略目录 `output/playwright/`。

## Vercel 发布

前端静态资源与同源网关部署到 Vercel；API Platform、KV 授权和私网 iClass 调用继续运行在 Cloudflare。Web 不需要 Cloudflare bindings、数据库或服务端 client secret。

1. 在 Vercel 导入本仓库，Framework Preset 选择 **Vite**，Node.js 选择 **22.x**。构建命令 `npm run build`，输出目录 `dist`；`vercel.json` 已声明这些配置。
2. 在 Vercel 项目的 Environment Variables 中设置 `SSO_ISSUER`、`SSO_CLIENT_ID` 和 `API_PLATFORM_BASE_URL`，分别选择需要的 Development、Preview、Production 环境。生产 API 与 SSO 均使用 HTTPS 源地址。这些变量由 Function 运行时读取，不使用 `VITE_` 前缀。
3. 给生产环境绑定确定的 Web 域名，在现有 SSO 公共 client 中精确登记 `https://<Web 域名>/oauth/callback`，保留 Android 回调。Preview 联调也需要固定域名和独立精确登记，不能直接依赖每次变化的预览 URL。未登记的预览地址只能验收匿名页面。
4. 先发布 API Platform 的接口并配置服务调用 HMAC 密钥，准备 `web-schedule-banner` 广告位；本次新增能力只使用现有 KV，不新增 D1 migration。
5. 执行类型检查、测试与构建后，可通过 Vercel Git 集成发布；或在明确选择并关联项目后运行 `npm run deploy`。后者执行 **生产部署**。仓库不会自动创建或关联线上项目。
6. Android 显式授权入口已接入“设置 → 账号资料 → 授权网页端”。正式开放前用真实账号验收 SSO、App 授权、课表、撤销和真实签到；本地模拟验证不能替代该步骤。

`vercel.json` 将 `/app-config`、`/oauth/token`、`/oauth/userinfo` 和 `/api/...` 交给固定目标网关；其余页面路径回退到 SPA，静态文件优先。未知业务 API 返回 JSON 404，不回退为 HTML。SSO 登录页仍由浏览器直接跳转访问。

Functions 最大运行时间为 60 秒，上游请求超时为 35 秒；个人响应和配置接口均 `no-store`。静态页面安全响应头由 Vercel 配置设置。网关不转发 SSO 登录 Cookie，不开放 Android 的授权写入接口，也不提供任意目标代理。

常规本地开发不需要 Vercel 账号。需要平台本地模拟时，先手动关联正确的项目并获取 Development 环境配置，再运行 `npm run dev:vercel`。本地 `.env` 文件不会自动同步至 Vercel；修改平台环境变量后需重新部署相应环境。

当前仓库不包含 Android 或 iclass-service 的改动，也不会自动创建生产 client 或广告投放。
