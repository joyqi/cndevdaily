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
5. **撰写推荐语** - 以主编 **Joyqi** 的声音写 120 字以内的推荐语，程序自动检查"AI 腔"套话与超长，不合格自动重写
6. **发布** - 发布到 Mastodon

> 相比"多角色讨论"，这套流程去掉了高成本低收益的 AI 角色辩论，把预算花在刀刃上：
> 用社区热度做粗筛（免费），用真实正文做精评（可靠），用"遗珠机制"弥补热度的盲区，把最好的 prompt 留给最终推荐语（决定观感）。

## AI 主编

主编 **Joyqi** 负责最终选文与推荐语撰写，风格真诚沉稳、不说空话套话。
推荐语会围绕文章里最具体的一个细节（数字、工具名、具体做法）展开，并由程序对套话词做硬性检查。
内容打分对 AI 方向（AI 开发、LLM、Agent、AI 工具链等）做适度加权，选文与遗珠挑选都会稍微偏向 AI 内容。

## 使用方法

### 环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入：

- `OPENAI_API_KEY` - OpenAI API 密钥
- `OPENAI_API_BASE_URL` - API 地址（可选，用于自定义 endpoint）
- `OPENAI_API_MODEL` - 模型名称（可选）
- `MASTODON_INSTANCE` - Mastodon 实例地址
- `MASTODON_ACCESS_TOKEN` - Mastodon 访问令牌

### 本地运行

```bash
pnpm install
pnpm dev  # DRY_RUN 模式，不发布到 Mastodon
```

### 构建

```bash
pnpm build
pnpm start
```

### GitHub Actions

配置以下 Secrets：

- `OPENAI_API_KEY`
- `OPENAI_API_BASE_URL`（可选）
- `OPENAI_API_MODEL`（可选）
- `MASTODON_INSTANCE`
- `MASTODON_ACCESS_TOKEN`

每天 UTC 00:00（北京时间 08:00）自动运行。

## 目录结构

```
cndevdaily/
├── src/                    # 源代码
│   ├── agents/             # AI 主编（内容打分 / 终选 / 推荐语）
│   ├── graph/              # LangGraph 工作流
│   ├── services/           # 外部服务
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数
├── personas/               # 主编人设 Markdown
├── data/                   # 历史记录
├── discussions/            # 每日运行记录存档
└── .github/workflows/      # GitHub Actions
```

## 技术栈

- Node.js + TypeScript
- LangGraph + LangChain
- OpenAI Compatible API
