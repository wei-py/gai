# gai

AI 驱动的 Git 分组提交工具。读取未提交改动，生成提交计划，确认后自动执行 `git add` 和 `git commit`。支持任意 OpenAI 兼容 API，默认使用 Conventional Commits。

[快速开始](#快速开始) · [网页配置](#网页配置) · [配置文件](#配置文件) · [English](#english)

## 安装

```sh
npm i -g @surfwei/gai
```

需要 Node.js 18+ 和 Git。也可从 [Releases](https://github.com/wei-py/gai/releases) 下载独立二进制，无需 Node.js。

## 快速开始

```sh
gai web         # 打开网页，设置 API Token、模型和 API 地址
```

保存配置后，按 Ctrl+C 停止网页服务。在 Git 仓库中运行：

```sh
gai --dry-run   # 预览提交计划，不修改暂存区或创建提交
gai             # 生成计划，确认后分组提交
```

运行前需保持暂存区为空。改动内容会发送到配置的模型服务，请先确认其中不含敏感信息。

## 网页配置

`gai web` 提供 API、语言、提交类型、格式模板和工单规则配置，点击“保存配置”写入文件。

- 提交类型支持多选和自定义；格式支持五种模板及自定义正则。
- 网页支持中文 / English、浅色 / 深色 / 跟随系统，独立于终端和提交信息语言。
- 被环境变量覆盖的字段为只读，保存时保留文件中的原值。

服务仅监听 `127.0.0.1`。浏览器未自动打开时，访问终端打印的地址；关闭页面不会停止服务。
更新程序后需重启 `gai web`。网页偏好仅在同一地址下保留，不跨随机端口共享。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `gai [目录]` | 为当前或指定目录的改动生成计划并提交 |
| `gai --dry-run` | 只预览计划 |
| `gai -y` | 跳过确认并提交 |
| `gai web` | 网页配置 |
| `gai config` | 终端配置，修改后立即保存 |
| `gai web --config ./gai.env` | 编辑指定配置文件 |
| `gai -h` / `gai -v` | 查看完整帮助 / 版本 |

## 配置文件

默认路径：`~/.config/gai/config.env`，支持 `XDG_CONFIG_HOME`。可用 `--config` 或 `GAI_CONFIG` 指定其他路径。

优先级：**命令行参数 > 环境变量 > 配置文件**。

以下是 DeepSeek 示例，Token 请替换为自己的密钥：

```sh
GAI_TOKEN=your-api-token
GAI_MODEL=deepseek-chat
GAI_BASE_URL=https://api.deepseek.com/v1
GAI_LANG=zh
GAI_COMMIT_LANG=zh
```

将这些内容写入配置文件，或通过 `gai web` 设置。不要提交或分享含 Token 的文件。
更多参数和环境变量见 `gai -h`。

## 提交格式

```text
feat(web): 添加配置页面
```

可配置类型、scope、Emoji、正文、标题长度（1–300，默认 72）和工单页脚。
只有标准模板遵循 Conventional Commits；其他格式可能不兼容自动发版或 changelog 工具。

## 更新

- npm 安装：`npm i -g @surfwei/gai@latest`
- 独立二进制：`gai update`，下载并校验后替换自身。

## 开发

```sh
bun install
bun run dev web    # 从源码启动网页配置
bun run check      # 类型检查
bun test           # 测试
bun run build:npm  # 构建 dist/cli.js，可用 node dist/cli.js web 运行
bun run build      # 构建当前平台独立二进制
bun run release    # 构建全部支持的平台
```

## English

`gai` uses an OpenAI-compatible API to plan and create grouped Git commits.

1. Install with `npm i -g @surfwei/gai` (Node.js 18+ and Git required), or download a standalone binary from [Releases](https://github.com/wei-py/gai/releases).
2. Run `gai web`, configure your API token, model and base URL, then save. Press Ctrl+C to stop the settings server.
3. In your repository, run `gai --dry-run` to preview, then `gai` to confirm and commit. The staging area must be empty.

Changes are sent to your configured model provider. Keep secrets out of the input and configuration files out of Git.
Configuration precedence is CLI flags > environment variables > `~/.config/gai/config.env`.
Run `gai -h` for all options. Update with `npm i -g @surfwei/gai@latest` or `gai update` for standalone binaries.

## License

MIT
