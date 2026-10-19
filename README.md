# RC帮

一个面向 RC 车友的闲置交易信息整合平台，使用 React、Vite 和 Supabase。平台仅展示群友发布的信息，不参与或担保交易；交易前请核实商品和卖家信息，谨慎交易。

## 本地启动

1. 安装 Node.js 18 或更高版本。
2. 安装依赖：`npm install`
3. 将 `.env.example` 复制为 `.env.local`，填写 Supabase Project URL 和 publishable key。
4. 在 Supabase Dashboard 的 SQL Editor 中运行 [`supabase/schema.sql`](./supabase/schema.sql)。如果数据库已创建，重新执行此脚本会迁移原有群名字段、添加注册频率限制、说明书资料表，以及头像和闲鱼链接所需字段与 Storage 策略。
5. 若只需增加“靓图欣赏”，运行增量脚本 [`supabase/rc_gallery.sql`](./supabase/rc_gallery.sql)，不会改动现有账号、商品或说明书数据。
6. 将提供的车型说明书目录导入数据库时，在 Supabase SQL Editor 中运行 [`supabase/import_manual_catalog.sql`](./supabase/import_manual_catalog.sql)。这些记录为公共只读资料，不归属个人账号；脚本可重复执行，不会按相同 PDF 链接重复插入。
7. 安装 Supabase CLI 并关联项目，然后部署昵称注册 Edge Function：`supabase functions deploy register-nickname --project-ref ygklgnablhnitcsptqor`。
8. 启动开发服务器：`npm run dev`

当前项目目录已包含本地 `.env.local` 配置；该文件已加入 `.gitignore`。

## 部署到 GitHub Pages

仓库 `heikaimu/rc-bang` 的 `main` 分支有新提交时，会通过 GitHub Actions 自动构建并发布。首次启用时，在仓库 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。

在 **Settings → Secrets and variables → Actions → Variables** 中添加以下 Repository variables，供前端构建连接 Supabase：

- `VITE_SUPABASE_URL`：Supabase Project URL。
- `VITE_SUPABASE_ANON_KEY`：Supabase publishable/anon key。该值会打包进浏览器前端，仅用于公开客户端；不要填写 service role key。

站点默认地址为 `https://heikaimu.github.io/rc-bang/`。

## 功能

- 集市浏览、分类筛选、关键词搜索。
- 微信昵称 + 密码注册 / 登录、个人联系方式资料维护。
- 所在群支持多选，可从常用群列表选择或输入其他群名；商品详情会展示卖家所在的全部群聊。
- 发布时自动带入个人资料中的微信号和所在群；发布、编辑、删除自己的闲置，或设置售卖中 / 已售 / 下架状态；下架商品会从公开集市隐藏。
- 说明书共享区支持添加“标题 + 封面图 + 链接”，封面可上传并裁剪为 300 × 200 JPEG；卡片展示，并在新窗口中打开说明书链接。
- 靓图欣赏独立页面展示 RC 美照；每位用户最多上传 10 张，照片会按现有压缩逻辑缩放至 1920 × 1080 边界内并保存为 JPEG，用户可以删除自己的照片。
- 每条发布最多上传 5 张图片；浏览器逐张压缩为 JPEG，最长边不超过 1920×1080 范围，质量约 80%，再上传到 Supabase Storage。
- 个人资料支持拖动、缩放裁剪头像，保存为 200 × 200 JPEG 并上传到独立的公开头像桶；头像只允许本人上传、更新和删除。
- 商品发布和编辑支持选填闲鱼链接，商品详情中提供安全的新窗口跳转。
- 商品公开详情会展示发布者填写的微信号和所在群。请只填写愿意公开给访客的信息。
- 网站仅作为群友闲置信息的整合展示平台，不参与、不担保任何交易。请自行核实商品信息和卖家身份，谨慎交易，并注意资金与个人信息安全。

注册和登录使用微信昵称及密码，不发送验证邮件。Supabase Auth 底层仍需要 email 作为账号字段；注册 Edge Function 使用 service role 在服务端直接创建已确认的内部账号并立即登录，service role key 不会暴露给浏览器。昵称不可重复，密码暂不支持自助找回，请提醒车友妥善保管。注册接口限制同一 IP 每小时最多 5 次。

注册接口需要先运行上面的 SQL 并部署 [`supabase/functions/register-nickname/index.ts`](./supabase/functions/register-nickname/index.ts)。部署时 Supabase 会为 Edge Function 提供项目 URL、anon key 和 service role key 环境变量。线上环境还需配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
