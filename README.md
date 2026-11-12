# CNDevDaily

欢迎关注我们的社交媒体：

| X (formerly Twitter) | Mastodon | Telegram |
|----------------------|----------|----------|
| [![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/CNDevDaily?style=social)](https://twitter.com/CNDevDaily) |[![Mastodon Follow](https://img.shields.io/mastodon/follow/269985?style=social)](https://mastodon.social/@CNDevDaily) | [![Static Badge](https://img.shields.io/badge/Follow_%40CNDevDaily-Channel-blue?style=social&logo=telegram&link=https%3A%2F%2Ft.me%2FCNDevDaily)](https://t.me/CNDevDaily) |

每日中文开发者新闻推荐，由 AI 主编基于真实内容选文并撰写推荐语。

## 工作流程

1. **抓取文章** - 从 Lobste.rs 和 HackerNews 各获取 25 篇热门文章
2. **候选筛选** - ① 按社区热度每源保留 Top 5；② 从剩余冷门文章里凭主编 **Joyqi** 的个人品味挑几篇"遗珠"作为备选（不只看热度，专捞被埋没的好文）
3. **内容评估** - 抓取全部候选正文，逐篇基于**真实内容**打分（新颖度 / 实用性 / 深度 / 相关性 / AI 相关度），并行执行。AI 相关度会适度加权，让 AI 方向的内容更容易被选上
4. **主编终选** - 从内容打分 Top 3 中选出一篇今日推荐，并给出选中理由（价值相当时偏向 AI 方向）
5. **撰写推荐语** - 以主编 **Joyqi** 的声音写 120 字以内的推荐语，由独立的 AI 评审扮演目标读者把关文风（套话、AI 句式、论文腔、黑话、长度等），不合格自动重写
6. **发布** - 同一份推荐语同时发布到 Mastodon 与 X（经 Typefully，超出 X 的 280 权重时按句裁剪），两个平台互不阻塞，任一成功即写入历史

> 相比"多角色讨论"，这套流程去掉了高成本低收益的 AI 角色辩论，把预算花在刀刃上：
> 用社区热度做粗筛（免费），用真实正文做精评（可靠），用"遗珠机制"弥补热度的盲区，把最好的 prompt 留给最终推荐语（决定观感）。

## AI 主编

主编 **Joyqi** 负责最终选文与推荐语撰写，风格真诚沉稳、不说空话套话。
推荐语参考阮一峰分享链接的平实口吻：就事论事讲清楚"这是什么、它做了什么"，开头每篇各不相同，不喊口号、不写"值得一读"。
文风质量由独立的 AI 评审（flash 级模型）扮演零背景读者把关，所有规则（套话词、AI 句式、论文腔、黑话、长度、Markdown 等）都在评审 prompt 里判断，代码不做文本匹配。
内容打分对 AI 方向（AI 开发、LLM、Agent、AI 工具链等）做适度加权，选文与遗珠挑选都会稍微偏向 AI 内容。

## 使用方法

### 环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入：

- `OPENAI_API_KEY` - OpenAI API 密钥
- `OPENAI_API_BASE_URL` - API 地址（可选，用于自定义 endpoint）
- `OPENAI_API_MODEL` - 默认模型（打分/选文）
- `OPENAI_API_MODEL_WRITER` - 写作专用模型（推荐语质量优先，可选）
- `OPENAI_API_MODEL_JUDGE` - 评审专用模型（文风把关，可选）
- `MASTODON_INSTANCE` - Mastodon 实例地址
- `MASTODON_ACCESS_TOKEN` - Mastodon 访问令牌
- `TYPEFULLY_API_KEY` - Typefully API 密钥（发布到 X，可选）
- `TYPEFULLY_SOCIAL_SET_ID` - Typefully 中 X 账号所在的 social set ID（可选）

### 本地运行

```bash
pnpm install
pnpm dev  # DRY_RUN 模式，不发布到 Mastodon 和 X
```

### 构建

```bash
pnpm build
pnpm start
```

### 测试

```bash
pnpm test
```

### GitHub Actions

配置以下 Secrets：

- `OPENAI_API_KEY`
- `OPENAI_API_BASE_URL`（可选）
- `OPENAI_API_MODEL`（可选）
- `OPENAI_API_MODEL_WRITER`（可选）
- `OPENAI_API_MODEL_JUDGE`（可选）
- `MASTODON_INSTANCE`
- `MASTODON_ACCESS_TOKEN`
- `TYPEFULLY_API_KEY`（可选）
- `TYPEFULLY_SOCIAL_SET_ID`（可选）

发布时刻见下一节。

## 发布时间

每天在 **UTC 05:00（北京时间 13:00）** 发布，任何一天只发一条。

- **唯一触发源**：外部定时器（cron-job.org）在 UTC 05:00 调用 GitHub API 触发 `workflow_dispatch`。workflow 没有 `schedule` cron——GitHub 的 cron 在整点高峰会被延迟数小时，不能用来准点发布。
- **每日去重**：启动时如果 `data/history.json` 里已有当天（UTC 日期）的记录，打印"今天已发布，跳过"并正常退出。`DRY_RUN` 时不做这个判断，本地可以重复跑。
- **串行执行**：workflow 的 `concurrency` 保证同一时刻只有一个 run，排队的 run 会看到前一个 run 提交的 history，从而被去重跳过。

### 配置外部定时器（以 cron-job.org 为例）

1. 在 GitHub 创建 fine-grained personal access token：Repository access 只选 `joyqi/cndevdaily`，Permissions 只给 **Actions: Read and write**。
2. 在 cron-job.org 新建任务：
   - URL：`https://api.github.com/repos/joyqi/cndevdaily/actions/workflows/daily.yml/dispatches`
   - 方法：`POST`
   - 请求头：
     - `Authorization: Bearer <上一步的 token>`
     - `Accept: application/vnd.github+json`
     - `Content-Type: application/json`
   - 请求体：`{"ref":"main"}`
   - 时间：每天 05:00，时区选 **UTC**
   - 打开失败通知（成功时 GitHub 返回 `204 No Content`）
3. 可以先在 cron-job.org 点 "Test run"，然后去 Actions 页面确认出现一次 `workflow_dispatch` 运行；当天已发过的话它会直接跳过。

### 外部定时器失败时

没有任何兜底触发：如果外部定时器失败（token 过期、cron-job.org 故障等），当天就不会发布。cron-job.org 的失败通知是唯一信号，收到后去仓库 Actions 页面选择 Daily DevNews，手动点 **Run workflow** 补发。

## 目录结构

```
cndevdaily/
├── src/                    # 源代码
│   ├── agents/             # AI 主编：editor（打分/终选/遗珠）、writer（推荐语写作+评审）、personas（主编人设）
│   ├── graph/              # LangGraph 工作流
│   │   └── nodes/          # fetch → selectCandidates → evaluate → write → publish
│   ├── services/           # 外部服务（HN / Lobsters / 抓取 / Mastodon / Typefully）
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数（历史、LLM、排序、重试、运行记录、X 长度）
├── scripts/                # 写作模型对比工具
├── tests/                  # 单元测试（vitest）
├── data/                   # 历史记录
├── discussions/            # 每日运行记录存档
└── .github/workflows/      # GitHub Actions
```

## 技术栈

- Node.js + TypeScript
- LangGraph + LangChain
- OpenAI Compatible API
