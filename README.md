# gai

[English](#install) | [中文使用文档](#中文使用文档)

AI-planned `git add` + `git commit` for any OpenAI-compatible API.

`gai` reads the uncommitted changes in a repo, asks your model for a commit plan,
and then stages **and** commits them as a series of Conventional Commits — one
coherent change per commit, each with the exact files it belongs to.

- any OpenAI-compatible endpoint (`base URL` + `model` + `token`: OpenAI, DeepSeek, …)
- Conventional Commits by default, with optional scope whitelist, emoji, body and
  subject-length rules
- optional ticket footer (`Refs: PROJ-123`) taken from the branch name
- commit message language independent of the interface language (`en` / `zh`)
- refuses to run when the index is dirty, and re-checks the file set before committing

## Install

```sh
npm i -g @surfwei/gai      # requires Node >= 18
```

Or use a standalone binary (no runtime required) from
[GitHub releases](https://github.com/wei-py/gai/releases):

```sh
# macOS arm64 example; also: gai-darwin-x64, gai-linux-x64, gai-linux-arm64, gai-windows-x64.exe
curl -fsSL -o gai https://github.com/wei-py/gai/releases/latest/download/gai-darwin-arm64
chmod +x gai && sudo mv gai /usr/local/bin/gai
```

Each release ships a `checksums.txt` next to the binaries.

## Requirements

An API token for an OpenAI-compatible endpoint. Nothing else: `gai` shells out to
`git` and talks HTTP to your provider.

## Quick start

```sh
gai config            # settings screen: token, model, language, commit rules
gai --dry-run         # print the commit plan without committing anything
gai                   # plan, confirm, then stage + commit
```

Typical non-interactive use:

```sh
GAI_TOKEN=sk-... GAI_MODEL=deepseek-chat gai -y
```

## Commands

| Command | Description |
| --- | --- |
| `gai [options] [dir]` | plan the uncommitted changes under `dir` (default `.`) and commit them in groups |
| `gai config` | open the settings screen; a selection is saved and applied immediately |
| `gai update` | self-update to the latest release (compiled binaries only) |
| `gai -v`, `--version` | print version |
| `gai -h`, `--help` | show help |

## Options

| Option | Description |
| --- | --- |
| `-token`, `--token <key>` | API token (prefer `GAI_TOKEN`: argv is visible in `ps` and shell history) |
| `-model`, `--model <name>` | model name, e.g. `deepseek-chat` or `gpt-4o-mini` |
| `-base-url`, `--base-url <url>` | OpenAI-compatible API base URL (default `https://api.openai.com/v1`) |
| `-y`, `--yes` | skip the confirmation prompt |
| `--dry-run` | print the commit plan without committing |
| `--config <path>` | `KEY=VALUE` config file (default `~/.config/gai/config.env`) |

## Configuration

Precedence: flag > environment variable > config file. Every key is editable in
`gai config`. The config file is `~/.config/gai/config.env` (honours
`XDG_CONFIG_HOME`, and `--config` / `GAI_CONFIG` override the path).

| Key | Env var | Meaning |
| --- | --- | --- |
| token | `GAI_TOKEN` | API token (legacy: `AI_API_KEY`) |
| model | `GAI_MODEL` | model name (legacy: `AI_MODEL`) |
| base url | `GAI_BASE_URL` | API base URL (legacy: `AI_BASE_URL`) |
| interface lang | `GAI_LANG` | `en` \| `zh` |
| commit language | `GAI_COMMIT_LANG` | `en` \| `zh` |
| commit types | `GAI_COMMIT_TYPES` | comma list, e.g. `feat,fix,docs,refactor` |
| message pattern | `GAI_COMMIT_PATTERN` | message regex with the named groups `type`, `scope`, `breaking`, `description` |
| scope | `GAI_COMMIT_SCOPE` | `1` allows `type(scope): subject` (default `1`) |
| scope whitelist | `GAI_COMMIT_SCOPES` | comma list of allowed scopes; empty = any scope |
| emoji | `GAI_COMMIT_EMOJI` | `1` prefixes the subject with the type emoji, e.g. `feat: ✨ subject` (default `0`) |
| body | `GAI_COMMIT_BODY` | `1` requires a body after a blank line (default `0`) |
| subject limit | `GAI_COMMIT_SUBJECT_MAX` | `50` \| `72` \| `100` (default `72`) |
| ticket pattern | `GAI_COMMIT_TICKET` | regex, e.g. `PROJ-[0-9]+`; appends a `Refs: <ticket>` footer taken from the branch name or `GAI_TICKET` |
| ticket required | `GAI_COMMIT_TICKET_REQUIRED` | `1` fails when no ticket matches (default `0`) |

`GAI_YES=1` is equivalent to `-y`.

```sh
# ~/.config/gai/config.env
GAI_TOKEN=sk-...
GAI_MODEL=deepseek-chat
GAI_BASE_URL=https://api.deepseek.com/v1
GAI_COMMIT_LANG=zh
GAI_COMMIT_TICKET=PROJ-[0-9]+
```

## Commit messages

```text
type(scope): subject        # imperative, <= subject limit, no trailing period
feat(ui): ✨ subject        # GAI_COMMIT_EMOJI=1 prepends the type emoji
                            # body (when enabled) follows one blank line and explains why
BREAKING CHANGE: <note>     # footer for breaking changes
Refs: <ticket>              # footer added from the branch name
```

## Updating

- standalone binary: `gai update` downloads the matching release asset, verifies it
  against `checksums.txt`, and replaces itself.
- npm install: update the package instead — `npm i -g @surfwei/gai@latest`.

## Development

```sh
bun install
bun run dev          # run from source
bun run check        # tsc --noEmit
bun run build:npm    # dist/cli.js, the bundle npm publishes
bun run release      # standalone binaries for all targets into dist/
```

`npm publish` runs `check` + `build:npm` first, so the tarball always contains a
fresh `dist/cli.js`.

## 中文使用文档

`gai` 是一个支持 OpenAI 兼容 API 的 Git 提交工具：读取仓库中尚未提交的改动，
让模型按逻辑生成提交计划，确认后自动执行 `git add` 和 `git commit`。
每组改动生成一条 Conventional Commits 格式的提交。

### 安装与准备

使用 npm 安装，需要 Node.js 18 或更高版本：

```sh
npm i -g @surfwei/gai
```

也可以从 [GitHub Releases](https://github.com/wei-py/gai/releases) 下载独立二进制，
无需安装 Node.js。以下以 macOS Apple Silicon 为例：

```sh
curl -fsSL -o gai https://github.com/wei-py/gai/releases/latest/download/gai-darwin-arm64
chmod +x gai && sudo mv gai /usr/local/bin/gai
```

其他平台可选择 `gai-darwin-x64`、`gai-linux-x64`、`gai-linux-arm64` 或
`gai-windows-x64.exe`；每个版本同时提供 `checksums.txt` 用于校验。

运行前需要安装 Git，并准备支持 OpenAI 兼容 API 的服务地址、模型名称和 API Token。

### 快速开始

在需要提交的 Git 仓库中执行：

```sh
gai config               # 打开设置界面，配置 Token、模型、语言和提交规范
gai --dry-run            # 仅预览提交计划，不执行提交
gai                      # 生成计划，确认后自动暂存并分组提交
```

建议先通过 `--dry-run` 检查分组和提交信息。`gai` 要求暂存区为空；
如果已有暂存内容，请先自行处理，再运行工具。真正提交前还会重新检查文件集合。

使用 DeepSeek 的环境变量示例：

```sh
export GAI_TOKEN='你的 API Token'
export GAI_MODEL=deepseek-chat
export GAI_BASE_URL=https://api.deepseek.com/v1
export GAI_LANG=zh
export GAI_COMMIT_LANG=zh

gai --dry-run
gai
```

界面语言与提交信息语言独立设置：例如 `GAI_LANG=zh`、`GAI_COMMIT_LANG=en`
表示中文界面、英文提交信息。

### 命令与参数

| 命令 | 说明 |
| --- | --- |
| `gai [options] [dir]` | 为指定目录中的未提交改动生成计划并分组提交，目录默认为 `.` |
| `gai config` | 打开交互式设置界面，选项修改后立即保存并生效 |
| `gai update` | 将独立二进制更新到最新版本，不适用于 npm 安装 |
| `gai -v`、`gai --version` | 查看版本 |
| `gai -h`、`gai --help` | 查看帮助 |

| 参数 | 说明 |
| --- | --- |
| `-token`、`--token <key>` | API Token；建议改用 `GAI_TOKEN`，避免密钥出现在进程参数或命令历史中 |
| `-model`、`--model <name>` | 模型名称，例如 `deepseek-chat`、`gpt-4o-mini` |
| `-base-url`、`--base-url <url>` | OpenAI 兼容 API 地址，默认 `https://api.openai.com/v1` |
| `-y`、`--yes` | 跳过确认，直接按计划提交 |
| `--dry-run` | 只打印提交计划，不执行提交 |
| `--config <path>` | 指定 `KEY=VALUE` 格式的配置文件 |

```sh
gai --dry-run /path/to/repo        # 预览指定仓库的提交计划
gai --config ./gai.env             # 使用指定配置文件
gai -y                            # 跳过确认，执行分组提交
```

### 配置文件与环境变量

配置优先级为：**命令行参数 > 环境变量 > 配置文件**。
默认配置文件为 `~/.config/gai/config.env`，支持 `XDG_CONFIG_HOME`；
也可通过 `--config` 或 `GAI_CONFIG` 指定路径。以下配置项均可在 `gai config` 中编辑。

| 环境变量 | 说明 |
| --- | --- |
| `GAI_TOKEN` | API Token，兼容旧变量 `AI_API_KEY` |
| `GAI_MODEL` | 模型名称，兼容旧变量 `AI_MODEL` |
| `GAI_BASE_URL` | API 地址，兼容旧变量 `AI_BASE_URL` |
| `GAI_LANG` | 界面语言：`en` 或 `zh` |
| `GAI_COMMIT_LANG` | 提交信息语言：`en` 或 `zh` |
| `GAI_COMMIT_TYPES` | 允许的提交类型，逗号分隔，例如 `feat,fix,docs,refactor` |
| `GAI_COMMIT_PATTERN` | 提交信息正则，使用命名捕获组 `type`、`scope`、`breaking`、`description` |
| `GAI_COMMIT_SCOPE` | 是否允许 `type(scope): subject`，默认 `1` |
| `GAI_COMMIT_SCOPES` | scope 白名单，逗号分隔；留空表示不限 |
| `GAI_COMMIT_EMOJI` | 是否在标题描述前添加类型对应的 emoji，默认 `0` |
| `GAI_COMMIT_BODY` | 是否要求提交正文，默认 `0` |
| `GAI_COMMIT_SUBJECT_MAX` | 标题长度上限：`50`、`72` 或 `100`，默认 `72` |
| `GAI_COMMIT_TICKET` | 工单号正则，例如 `PROJ-[0-9]+`；从分支名或 `GAI_TICKET` 提取工单号并追加 `Refs: <ticket>` |
| `GAI_COMMIT_TICKET_REQUIRED` | 未匹配到工单号时是否报错，默认 `0` |

布尔配置使用 `1` 表示启用、`0` 表示关闭。`GAI_YES=1` 等价于 `-y`。

配置文件示例：

```sh
# ~/.config/gai/config.env
GAI_TOKEN=你的 API Token
GAI_MODEL=deepseek-chat
GAI_BASE_URL=https://api.deepseek.com/v1
GAI_LANG=zh
GAI_COMMIT_LANG=zh
GAI_COMMIT_TICKET=PROJ-[0-9]+
```

### 提交信息格式

默认采用 Conventional Commits 格式：

```text
feat(ui): 添加设置页面
```

标题描述使用祈使语气，不以句号结尾，并遵守配置的长度上限。
启用 `GAI_COMMIT_EMOJI=1` 后，标题示例为 `feat(ui): ✨ 添加设置页面`。
启用正文后，正文与标题之间空一行，用于说明改动原因；
破坏性变更使用 `BREAKING CHANGE: <说明>` 页脚，工单引用使用 `Refs: PROJ-123` 页脚。

### 更新

- npm 安装：执行 `npm i -g @surfwei/gai@latest`。
- 独立二进制：执行 `gai update`，工具会下载对应平台的版本，
  使用 `checksums.txt` 校验后替换自身。

### 源码开发

```sh
bun install
bun run dev          # 从源码运行
bun run check        # TypeScript 类型检查
bun run build:npm    # 构建 npm 发布文件 dist/cli.js
bun run release      # 将各平台独立二进制构建到 dist/
```

`npm publish` 会先执行类型检查和 npm 构建，确保发布包包含最新的 `dist/cli.js`。

## License

MIT
