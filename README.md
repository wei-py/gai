# gai

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

## 中文速览

AI 规划的分组提交：读未提交改动 → 让模型给出提交计划 → 按计划 `git add` + `git commit`。

```sh
npm i -g @surfwei/gai     # 需要 Node >= 18；也可从 GitHub releases 下载免运行时的二进制
gai config               # 设置 token、模型、语言与提交规范
gai --dry-run            # 只打印计划
gai                      # 确认后真正提交（-y 跳过确认）
```

配置优先级：命令行 > 环境变量 > 配置文件（`~/.config/gai/config.env`，也可用
`--config` 或 `GAI_CONFIG` 指定）。常用环境变量：`GAI_TOKEN`、`GAI_MODEL`、
`GAI_BASE_URL`、`GAI_LANG`、`GAI_COMMIT_LANG`、`GAI_COMMIT_TYPES`、`GAI_COMMIT_EMOJI`、
`GAI_COMMIT_TICKET`；`gai -h` 里有完整表格（`GAI_LANG=en` 可切换为英文帮助）。

更新：二进制安装用 `gai update`；npm 安装用 `npm i -g @surfwei/gai@latest`。

## License

MIT
