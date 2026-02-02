# DevNews Bot

每日开发者新闻推荐机器人，由 AI 模拟多角色讨论评选。

## 工作流程

1. **抓取文章** - 从 Lobste.rs 和 HackerNews 各获取 25 篇热门文章
2. **标题评选** - 8 位 AI 角色讨论投票，选出 Top 3
3. **内容抓取** - 获取 Top 3 文章正文并生成摘要
4. **内容评选** - 基于文章内容再次讨论，选出当日最佳
5. **发布** - 生成 120 字推荐语，发布到 Mastodon

## AI 角色

| 角色 | 关注点 |
|------|--------|
| 前端工程师 | UI/UX、JavaScript 生态 |
| 后端架构师 | 系统设计、性能 |
| DevOps 工程师 | 部署、云原生 |
| 独立开发者 | 产品、商业化 |
| 技术新人 | 学习资源、最佳实践 |
| 产品经理 | 用户价值、市场趋势 |
| 设计师 | 用户体验、美学 |
| 科技极客 | 新技术、前沿研究 |

## 使用方法

### 环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入：

- `OPENAI_API_KEY` - OpenAI API 密钥
- `MASTODON_INSTANCE` - Mastodon 实例地址（如 `https://mastodon.social`）
- `MASTODON_ACCESS_TOKEN` - Mastodon 访问令牌

### 本地运行

```bash
pnpm install
pnpm dev
```

### 构建

```bash
pnpm build
pnpm start
```

### GitHub Actions

配置以下 Secrets：

- `OPENAI_API_KEY`
- `MASTODON_INSTANCE`
- `MASTODON_ACCESS_TOKEN`

每天 UTC 00:00（北京时间 08:00）自动运行。

## 目录结构

```
devnews/
├── src/                    # 源代码
│   ├── agents/             # AI 角色
│   ├── graph/              # LangGraph 工作流
│   ├── services/           # 外部服务
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数
├── personas/               # 角色定义 Markdown
├── data/                   # 历史记录
├── discussions/            # 讨论记录存档
└── .github/workflows/      # GitHub Actions
```

## 技术栈

- Node.js + TypeScript
- LangGraph + LangChain
- OpenAI GPT-4o-mini
