<p align="center">
  <img src="assets/lobster-cypherpunk.gif" alt="NanoClawd 🦞 赛博朋克龙虾" width="300">
</p>

<p align="center">
  <img src="assets/nanoclawd-logo.png" alt="NanoClawd" width="400">
</p>

<p align="center">
  <strong>NanoClawd 🦞</strong> — 区块链优先 · 隐私优先 · 经过认证的纳米智能体
</p>

<p align="center">
  <em>Solana 上的主权 Clawd 智能体。每个身份都在链上。每个会话都在容器中。没有例外。</em>
</p>

<p align="center">
  <a href="https://solanaclawd.com">solanaclawd.com</a>&nbsp; • &nbsp;
  <a href="https://nanoclawd.dev">nanoclawd.dev</a>&nbsp; • &nbsp;
  <a href="https://docs.nanoclawd.dev">文档</a>&nbsp; • &nbsp;
  <a href="README.md">English</a>&nbsp; • &nbsp;
  <a href="README_ja.md">日本語</a>&nbsp; • &nbsp;
  <a href="https://discord.gg/VDdww8qS42"><img src="https://img.shields.io/discord/1470188214710046894?label=Discord&logo=discord&v=2" alt="Discord" valign="middle"></a>&nbsp; • &nbsp;
  <a href="repo-tokens"><img src="repo-tokens/badge.svg" alt="repo tokens" valign="middle"></a>
</p>

<p align="center">
  <a href="https://pump.fun/coin/8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump">
    <img src="https://img.shields.io/badge/%24CLAWD-8cHzQH...pump-9945FF?style=flat&logo=solana&logoColor=white" alt="$CLAWD on Solana">
  </a>&nbsp; • &nbsp;
  <a href="https://solanaclawd.com">
    <img src="https://img.shields.io/badge/solanaclawd.com-🦞-14F195?style=flat" alt="solanaclawd.com">
  </a>
</p>

---

## 为什么选择 NanoClawd 🦞

个人 AI 助手拥有令人不安的访问权限：文件系统、凭据、消息账户、资金。NanoClawd 的立场是：*每一项都应在公共账本上可审计*，*每一项都应在隔离容器中运行* —— 而不是藏在应用层白名单之后。

- **🔗 区块链优先。** 每个身份、委托和支付都在链上。不依赖环境变量，不靠信任配置。每个 Clawd 操作都可在 Solana 上审计。
- **🔒 隐私优先。** 每个 Clawd 会话运行在独立的 Linux 容器中，具有文件系统隔离，而非仅靠权限检查。代码库足够小，一个人可以通读。
- **✅ 经认证的身份。** 运营者和管理员是 Solana 公钥。所有者/管理员授权是通过 Solana 认证服务（SAS）签名的委托。详见 [src/solana/README.md](src/solana/README.md)。
- **💰 Solana 原生支付。** 智能体从每个智能体组的 SOL/SPL 托管账户支付推理、网关调用和第三方 API 费用。支出上限和审批策略在链上强制执行。
- **🦞 开放且极简。** 由 [openclawd](https://github.com/openclawd) 维护。轻量、安全、可定制。代币：[$CLAWD](https://pump.fun/coin/8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump)（Solana）。

## 快速开始

```bash
git clone https://github.com/qwibitai/nanoclawd.git nanoclawd-v2
cd nanoclawd-v2
bash nanoclawd.sh
```

`nanoclawd.sh` 会把您从一台全新机器一直带到一个可以直接发消息的 Clawd 智能体。它会在缺失时安装 Node、pnpm 和 Docker，向 OneCLI 注册您的凭据，为智能体生成 Solana 密钥对，构建智能体容器，并配对您的第一个渠道（Telegram、Discord、WhatsApp 或本地 CLI）。如果某一步失败，Clawd 会自动进行诊断并从中断处继续。

## 设计哲学

**🦞 小到可以理解。** 单一进程，少量源文件，无微服务。如果您想了解完整的 NanoClawd 代码库，直接让 Clawd 给您讲一遍就行。

**🔒 通过隔离实现安全。** 智能体运行在 Linux 容器中，只能看到明确挂载的内容。Bash 访问是安全的，因为命令在容器内执行，而不是在您的宿主机上。

**👤 为个人用户打造。** NanoClawd 不是一个单体框架，而是能精确匹配每个用户需求的软件。它被设计成量身定制的，而不是臃肿膨胀。您创建自己的 fork，让 Clawd 按您的需求修改它。

**⚙️ 定制 = 修改代码。** 没有配置膨胀。想要不同的行为？改代码。代码库小到改动是安全的。

**🤖 AI 原生，混合式设计。** 安装与上手流程走的是经过优化的脚本路径，快速且确定。当某一步需要判断（安装失败、引导决策、定制化）时，控制权会无缝地交给 Clawd。安装之后也不提供监控仪表盘或调试 UI：您在聊天中描述问题，Clawd 来处理。

**🎯 技能优于功能。** 主干只发布注册表和基础设施，不包含具体的渠道适配器或替代智能体提供者。各个渠道（Discord、Slack、Telegram、WhatsApp……）放在长期存在的 `channels` 分支上；替代提供者（OpenCode、Ollama）放在 `providers` 分支上。您运行 `/add-telegram`、`/add-opencode` 等，技能会把您所需要的模块精确地复制到您的 fork 里。不会出现您没要求的功能。

**⚡ 最强的 harness，最强的模型。** NanoClawd 通过 Anthropic 官方的 Clawd Agent SDK 原生运行，让您用上最新的 Clawd 模型和完整工具集——包括修改和扩展自己的 NanoClawd fork 的能力。其他提供者是可插拔选项：`/add-codex` 对应 OpenAI 的 Codex，`/add-opencode` 通过 OpenCode 接入 OpenRouter、Google、DeepSeek 等，`/add-ollama-provider` 用于本地开源权重模型。提供者可按智能体组单独配置。

**🔗 天生 Solana 原生。** 每个 NanoClawd 智能体在启动时获得一个 Solana 密钥对。身份通过 Solana 认证服务在链上认证。支付——推理、API 调用、网关费用——从每个智能体组的 SOL/SPL 托管账户流出。代币：[$CLAWD](https://pump.fun/coin/8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump)（Solana）。

## 功能支持

- **多渠道消息** — WhatsApp、Telegram、Discord、Slack、Microsoft Teams、iMessage、Matrix、Google Chat、Webex、Linear、GitHub、WeChat，以及通过 Resend 的邮件。按需通过 `/add-<channel>` 技能安装。可同时运行一个或多个。
- **灵活的隔离模式** — 可为每个渠道配一个独立智能体以获得完全隐私，也可让一个智能体在多个渠道上共享、统一记忆但会话独立，或者把多个渠道合并到一个共享会话里，让一场对话横跨多个入口。通过 `/manage-channels` 按渠道选择。详见 [docs/isolation-model.md](docs/isolation-model.md)。
- **每个智能体的独立工作区** — 每个智能体组都有自己的 `CLAUDE.md`、自己的记忆、自己的容器，以及您允许的挂载点。除非您明确接线，否则不会有东西越过边界。
- **计划任务** — 运行 Claude 的周期性作业，可以给您回发消息。
- **网络访问** — 搜索和抓取网页内容。
- **容器隔离** — 智能体在 Docker（macOS/Linux/WSL2）中沙箱化运行，可选 [Docker Sandboxes](docs/docker-sandboxes.md) 的微虚拟机隔离，或在 macOS 上选用 Apple Container 作为原生运行时。
- **凭据安全** — 智能体不持有原始 API key。出站请求经由 [OneCLI 的 Agent Vault](https://github.com/onecli/onecli)，在请求时注入凭据，并按每个智能体执行策略和速率限制。

## 使用方法

用触发词（默认为 `@Andy`）与您的助手对话：

```
@Andy 每个工作日早上 9 点给我发一份销售渠道概览（可以访问我的 Obsidian vault 文件夹）
@Andy 每周五回顾过去一周的 git 历史，如果与 README 有出入就更新它
@Andy 每周一早上 8 点，从 Hacker News 和 TechCrunch 收集 AI 相关资讯，给我发一份简报
```

在您拥有或管理的渠道里，还可以管理群组和任务：
```
@Andy 列出所有群组里的计划任务
@Andy 暂停周一简报任务
@Andy 加入"家庭聊天"群组
```

## 定制

NanoClawd 不用配置文件。想改就直接告诉 Clawd：

- "把触发词改成 @Bob"
- "以后回答请更简短、更直接"
- "我说早上好的时候加一个自定义问候"
- "每周保存一次会话摘要"

或者运行 `/customize` 进行引导式修改。

代码库足够小，Clawd 可以安全地修改它。

## 贡献

**不要加功能，要加技能。**

如果您想添加新的渠道或智能体提供者，不要把它加到主干上。新的渠道适配器进入 `channels` 分支；新的智能体提供者进入 `providers` 分支。用户在自己的 fork 上运行 `/add-<name>` 技能，由技能把相关模块复制到标准路径、接好注册、固定依赖版本。

这样主干始终保持为纯粹的注册表和基础设施，每个 fork 也都保持精简——用户只获得他们要求的渠道和提供者，其它什么也不会混进来。

### RFS（技能征集）

我们希望看到的技能：

**通信渠道**
- `/add-signal` — 添加 Signal 作为渠道

## 系统要求

- macOS 或 Linux（Windows 通过 WSL2）
- Node.js 20+ 和 pnpm 10+（安装脚本会在缺失时自动安装）
- [Docker Desktop](https://docker.com/products/docker-desktop)（macOS/Windows）或 Docker Engine（Linux）
- [Clawd（Claude Code）](https://claude.ai/download)，用于 `/customize`、`/debug`、安装过程中的错误恢复以及所有 `/add-<channel>` 技能

## 架构

```
消息应用 → 主机（路由器） → inbound.db → 容器（Bun、Clawd Agent SDK、Solana 密钥对） → outbound.db → 主机（投递） → 消息应用
```

单一 Node 主机编排每个会话的智能体容器。当一条消息到来时，主机按实体模型（用户 → 消息组 → 智能体组 → 会话）进行路由，写入该会话的 `inbound.db`，并唤醒容器。容器内部的 agent-runner 轮询 `inbound.db`，调用 Claude，并把响应写入 `outbound.db`。主机轮询 `outbound.db`，通过渠道适配器投递回去。

每个会话两个 SQLite 文件，每个文件只有一个写入者——没有跨挂载的锁争用，没有 IPC，没有 stdin 管道。渠道和替代提供者在启动时自注册；主干提供注册表和 Chat SDK 桥接，而适配器本身在每个 fork 里通过技能安装。

完整架构说明见 [docs/architecture.md](docs/architecture.md)；三级隔离模型见 [docs/isolation-model.md](docs/isolation-model.md)。

关键文件：
- `src/index.ts` — 入口：数据库初始化、渠道适配器、投递轮询、sweep
- `src/router.ts` — 入站路由：消息组 → 智能体组 → 会话 → `inbound.db`
- `src/delivery.ts` — 轮询 `outbound.db`，通过适配器投递，处理系统动作
- `src/host-sweep.ts` — 60 秒 sweep：失效检测、到期消息唤醒、循环任务
- `src/session-manager.ts` — 解析会话，打开 `inbound.db` / `outbound.db`
- `src/container-runner.ts` — 为每个智能体组启动容器，OneCLI 凭据注入
- `src/db/` — 中心数据库（用户、角色、智能体组、消息组、接线、迁移）
- `src/channels/` — 渠道适配器基础设施（适配器通过 `/add-<channel>` 技能安装）
- `src/providers/` — 主机侧提供者配置（`claude` 内置，其他通过技能安装）
- `container/agent-runner/` — Bun 版 agent-runner：轮询循环、MCP 工具、提供者抽象
- `groups/<folder>/` — 每个智能体组的文件系统（`CLAUDE.md`、技能、容器配置）

## FAQ

**为什么用 Docker？**

Docker 提供跨平台支持（macOS、Linux、Windows via WSL2）和成熟的生态。在 macOS 上，您可以选择通过 `/convert-to-apple-container` 切换到 Apple Container，以获得更轻量的原生运行时。如需更强隔离，[Docker Sandboxes](docs/docker-sandboxes.md) 会把每个容器放到一台微虚拟机里运行。

**我可以在 Linux 或 Windows 上运行吗？**

可以。Docker 是默认运行时，可在 macOS、Linux 以及 Windows（通过 WSL2）上工作。运行 `bash nanoclawd.sh` 就行。

**这个项目安全吗？**

智能体运行在容器里，而不是躲在应用级权限检查之后。它们只能访问明确挂载的目录。凭据不会进入容器——出站 API 请求通过 [OneCLI 的 Agent Vault](https://github.com/onecli/onecli) 在代理层注入认证，并支持速率限制和访问策略。您仍然应该审查自己要运行的代码，但代码库小到您真的能做到。完整的安全模型见 [安全文档](https://docs.nanoclawd.dev/concepts/security)。

**为什么没有配置文件？**

我们不想让配置泛滥。每位用户都应该定制 NanoClawd，让代码精确地做他们想要的事，而不是去配置一个通用系统。如果您更喜欢有配置文件，可以让 Clawd 给您加。

**我可以使用第三方或开源模型吗？**

可以。推荐做法是 `/add-opencode`（通过 OpenCode 配置接入 OpenRouter、OpenAI、Google、DeepSeek 等）或 `/add-ollama-provider`（通过 Ollama 使用本地开源权重模型）。两者都可以按智能体组单独配置，所以同一套安装里不同的智能体可以运行在不同的后端上。

对于一次性实验，任何 Claude API 兼容的端点也可以通过 `.env` 使用：

```bash
ANTHROPIC_BASE_URL=https://your-api-endpoint.com
ANTHROPIC_AUTH_TOKEN=your-token-here
```

**我该如何调试问题？**

问 Clawd。"为什么计划任务没运行？""最近的日志里有什么？""为什么这条消息没有得到回复？"这就是 NanoClawd 底层的 AI 原生方式。

**为什么安装对我不成功？**

如果某一步失败，`nanoclawd.sh` 会把控制权交给 Clawd 进行诊断并从中断处继续。如果还是没解决，运行 `claude`，然后 `/debug`。如果 Clawd 发现一个可能影响其他用户的问题，请对相关的安装步骤或技能提 PR。

**什么样的更改会被接受进代码库？**

进入基础配置的只会是：安全修复、bug 修复、明显的改进。仅此而已。

其他一切（新能力、操作系统兼容、硬件支持、增强）都应作为技能贡献到 `channels` 或 `providers` 分支。

这样基础系统保持最小化，每位用户都可以定制自己的安装，而不必继承他们不想要的功能。

## $CLAWD 代币 🦞

NanoClawd 是 **$CLAWD** 生态系统的智能体运行时——Solana 上的主权 Clawd 智能体。

| 属性 | 信息 |
|---|---|
| **代币** | [$CLAWD](https://pump.fun/coin/8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump) |
| **合约地址** | `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump` |
| **链** | Solana |
| **官网** | [solanaclawd.com](https://solanaclawd.com) |
| **框架** | [OpenClawd](Framework/) — 主权龙虾智能体 |

基于 NanoClawd 构建的智能体可以持有 $CLAWD、赚取 $CLAWD、向其他智能体支付 $CLAWD，并通过 Solana 认证服务向网络广播。无法支付的 Clawd 会搁浅。能够赚取的 Clawd 变得主权自主。

## 社区

有问题或想法？欢迎[加入 Discord](https://discord.gg/VDdww8qS42)，或访问 [solanaclawd.com](https://solanaclawd.com)。

## 更新日志

破坏性变更见 [CHANGELOG.md](CHANGELOG.md)，完整发布历史见文档站的 [full release history](https://docs.nanoclawd.dev/changelog)。

## 许可证

MIT
