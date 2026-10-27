# 验证记录

日期：2026-10-27。以下为本地测试与模拟浏览器证据，未发布生产或提交真实签到。

## 自动化

- Web：8 个测试文件，34 项测试通过。
- API Platform：12 个 Worker 测试文件，167 项测试通过；9 个管理端测试文件，105 项测试通过。
- API Platform 的 TypeScript 检查与生产构建通过。Vercel 适配后，Web 类型检查与 Vite 生产构建通过，静态资源输出至 `dist/`。
- 使用 `@vercel/node` 8.1.0 官方 builder 在本地构建网关，产物运行时为 `nodejs22.x`，包含网关、配置和代理模块，无 Cloudflare 依赖。
- 使用 `@vercel/routing-utils` 对实际 `vercel.json` 转换结果进行测试，覆盖静态文件优先、页面深链接、回调路径、API JSON 404，以及重写参数不泄漏到业务查询。
- 本地以隔离 Node 22.23.0 验证，不改动系统 Node。Vercel CLI 锁定为 59.6.2。

另有 Strict Mode 返回课表滚动恢复与异常响应解析回归。

覆盖 PKCE S256 标准向量、state 重复/不匹配/过期、回调一次性消费、Refresh Token 持久化和跨标签页串行轮换、网络故障保留凭据、换号拦截、公告/广告移除用户凭据、固定代理目标与回调验证、危险站外返回路径、错误日期和签到时间边界。

API 回归覆盖 KV 直接保存 loginName、授权替换、跨用户隔离、空课表授权、上游故障保留旧授权、KV 损坏/读取失败、撤销后的本地读取、上游结果不额外合并、课程归属、KV 签到租约（尽力防重复，不提供严格互斥）、时段外确认、已签到短路、提交结果不明不重试及无效上游信封。

## 浏览器

首次功能验收使用 Playwright 打开本地真实 React 页面和当时的 Workers 开发服务，网络层注入**合成** SSO、授权、课表、广告和签到响应。没有使用生产 token、真实学生数据或真实签到接口。

- 320、375、390、430px 视口检查：页面宽度不超过视口，无横向溢出。
- 检查长课程名、多教师、多教室、周历跨月日期和固定底部导航。
- 实际文字尺寸为 12、14、18px，未添加过渡动画。
- 从课表打开原始 ID 对应的课程详情；时段外先出现确认，用户确认后才执行第二次模拟提交，成功刷新为已签到并禁用按钮；返回时保留原日期。
- 迁移前构建产物曾通过本地 Workers preview 验证：课表/公告详情深链接返回 SPA HTML 并携带生产 CSP，`/app-config` 返回 JSON，`/api/admin/apps` 返回 JSON 404。
- 公告列表与 Markdown 详情、账号授权状态页面均通过浏览器导航检查。
- 详情截图：`output/playwright/course-signed-390.png`；确认截图：`output/playwright/sign-confirmation-390.png`。
- 四种宽度课表截图：`output/playwright/schedule-320.png`、`schedule-375.png`、`schedule-390.png`、`schedule-430.png`。

开发环境首次检查暴露了生产 CSP 拦截 Vite 开发预处理脚本的问题，已修复为开发模式不添加生产 CSP；生产构建保留同源脚本策略。时段外模拟 HTTP 409 会在浏览器网络日志留下预期失败记录，不代表前端崩溃。

## 生产前置条件

SSO 公共 client 的实际 ID、精确 Web 回调登记、API Platform 的服务调用配置、广告位投放与 Android 显式授权入口仍需按接入说明配置或交付。KV 为最终一致性，跨节点授权更新/撤销不承诺即时生效。真实账号的 SSO 与签到仍需单独联调验收。

## KV 存储调整

签到租约从数据库改存现有 KV，并删除未发布的租约建表迁移。本次新增能力不访问 D1；KV 设置 90 秒 TTL，按可见记录检查正在执行的请求，清理失败依靠 TTL 恢复。KV 的读写和条件删除不原子，不能保证跨节点严格互斥或恰好一次签到。

KV 调整后重新通过 API Platform 全部 167 项 Worker 测试及 Worker TypeScript 检查。新增覆盖可见租约拦截、用户隔离、90 秒过期与 TTL 配置、按记录 ID 释放，以及 KV 损坏/故障和清理失败的处理。

## Vercel 适配验证

网关函数测试覆盖原始 POST 请求体、用户凭据、公共源回调校验、重写后 URL 与保留原始 URL 两种形态，以及缺失或重复内部路由参数、跨站请求与不支持的方法。Node HTTP 集成测试实际监听本地端口，确认页面路径交给 SPA、未知 API 返回 JSON、签到请求体和 Bearer 正确转发、响应禁止缓存且不透传 Cookie。所有上游响应均为模拟。

本地 Vercel 项目检查结果为 `link_required`，仓库尚未关联项目。没有执行线上部署、生产环境变量写入或真实账号签到。官方 Node builder 的本地构建和路由转换测试不等于已部署的 Vercel CDN/Functions 验收；平台上的深链接、SSO 与真实业务链路仍需发布后复验。

迁移后重新在本地 Vite production preview 验收：课表详情、公告详情与 OAuth callback 返回 SPA HTML 和生产 CSP；`/app-config` 返回 `no-store` JSON，`/api/admin/apps` 返回 `no-store` JSON 404。Playwright 使用同一组合成数据重新检查 320、375、390、430px，均无横向溢出；截图保存在 `output/playwright/vercel-schedule-<width>.png`。匿名检查时未配置投放的广告接口返回 404，页面按预期不占位；浏览器另有缺失 favicon 的资源 404，无页面脚本崩溃。

## 授权存储简化

按最新要求，KV 直接保存 `{ login_name, authorized_at }`，已移除加解密模块与额外授权密钥配置。请求期间仍检查授权记录是否被撤销、替换或更新，发现变化时停止签到。状态接口只返回授权状态与时间，跨用户隔离、上游故障保留旧授权及撤销行为均有回归覆盖。调整后 167 项 Workers 测试、Worker 和管理端 TypeScript 检查、生成类型一致性检查及 API Platform 生产构建通过。
