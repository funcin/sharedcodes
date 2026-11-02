# 经验教训

## 2026-10-27 - 调研结论下早了
**问题**: 分析 dingyue.xzys.me 时，只搜到上游 Renewlet 仓库没有共享收件箱代码，就断言"分享层是站长私有二开、不公开"。实际 SubNest 本身开源（zxyszx/subnest），共享收件箱代码就在里面。
**原因**: 只按产品名做了一次泛搜索，没有用 GitHub 仓库搜索按名字精确查，也没查 Renewlet 的 fork 列表。
**教训**: 判断"某功能有没有开源实现"之前，至少做三件事：GitHub 按仓库名搜、看上游仓库的 fork 列表、用代码搜索查独特的接口路径/标识符。
**规则**: 对"不存在/不公开"这类否定结论，必须给出检索方式和范围，没有穷举就写"未找到"而不是"没有"。

## 2026-10-27 - Workers Builds 首次构建失败
**问题**: 推上去的首个版本在 Workers Builds 构建失败，锁定 `packageManager: pnpm@11.15.1` 和 `.node-version` 22 后通过。
**原因**: 本地用 pnpm 11 生成锁文件并在 pnpm-workspace.yaml 用了 `allowBuilds`，没告诉 CI 用哪个 pnpm/Node，CI 默认版本对不上。
**教训**: 新建 Cloudflare 项目时骨架就要带 `packageManager` + `.node-version`（和 freesongmaker 一致），不要等 CI 报错。
**规则**: 初始化任何走 Workers Builds 的项目，第一个提交必须包含 `packageManager` 与 `.node-version`。

## 2026-10-28 - 手机端“返回列表”点了没反应
**问题**: 分享页手机视图看完第二封 HTML 邮件后，点“返回列表”第一次没反应，正文还变成空白，第二次才回到列表。
**原因**: 详情区复用同一个 iframe，反复设置 srcdoc；已存在的 iframe 再次导航会往浏览器联合历史里加一条记录。`history.back()` 先回退的是 iframe 那条（正文随之变空），页面的 popstate 不触发。
**教训**: 用 iframe 展示会变化的内容时，每次都新建 iframe 再替换，新 iframe 的首次加载不进历史；“是否推过历史”用自己的变量记，不要依赖 history.state。
**规则**: 任何靠 pushState/popstate 做页内导航的页面，内部不得复用 iframe 做二次导航。

## 2026-11-02 - 覆盖样式的 !important 把自己的内联 max-width 压掉了
**问题**: 给邮件表格写了内联 `width:100%;max-width:600px`，又在覆盖表里写 `table{max-width:100%!important}`，结果 600px 的表格在桌面变成满宽。
**原因**: `!important` 的样式表声明优先级高于非 important 的内联声明，自己写的两条规则打架。
**教训**: 同一属性别同时出现在「内联」和「带 !important 的覆盖表」里；覆盖表只对不需要内联再调整的属性（min-width:0、height:auto）加 !important。

## 2026-11-02 - 表格布局里百分比 max-width 缩不了单元格
**问题**: 图片 / 段落写成 `width:600px;max-width:100%` 放在表格单元格里，手机上单元格仍被撑到 600 + 内边距。
**原因**: 表格自动布局算最小列宽时，像素 width 算进最小宽度，百分比 max-width 对收缩容器解析不了；反过来 `width:100%;max-width:600px` 的百分比 width 在算最小宽度时当 auto，才缩得下去（邮件行业的「hybrid」写法）。`td width="300"` 同理是最小宽度，要改成占表格的百分比。
**教训**: 让邮件在窄 iframe 里流式化，一律用 `width:100%;max-width:Npx`，单元格像素宽转百分比。

## 2026-11-02 - 页面 CSP 没有 unsafe-eval 时 Playwright 的 waitForFunction 会炸
**问题**: `page.waitForFunction` 报 EvalError（CSP 不允许 eval）。
**教训**: 严格 CSP 的页面用 `waitForSelector('#x.hidden', { state: 'attached' })` 这类选择器等待；`page.evaluate(fn)` 不受影响。Chrome 扩展的 `resize_window` 在本机缩不到 390 宽，手机视口要靠 Playwright（`channel: 'chrome'`, headless）。

## 2026-11-02 - Worker 改名后 Workers Builds 的部署命令被重置，构建"成功"却部署了错误配置
**问题**: 在 Dashboard 原地把 Worker 从 `inboxshare` 改名 `sharedcodes` 后，推送触发的构建显示成功，但线上版本的变量全空、`send_email` 绑定消失、新域名没绑上。
**原因**: Builds 的部署命令被重置成默认的 `npx wrangler deploy`，用的是顶层通用模板而不是 `--env production`。构建状态只反映命令是否退出 0，不反映部署的是哪套配置。
**教训**: 部署后不能只看构建绿灯，要用 `wrangler versions view <id> --name <worker>` 核对变量和绑定，或直接 curl 关键 URL；Dashboard 侧对 Worker 的任何改动（改名、重连仓库）之后，先确认 Settings → Build 的部署命令仍是 `pnpm run deploy:production`。
**规则**: 顶层模板与 `env.production` 并存的项目，每次部署验证清单第一条就是"线上 PUBLIC_BASE_URL 是不是生产值"。
