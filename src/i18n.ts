export type Lang = 'en' | 'zh';

let lang: Lang = 'en';

export function setLang(next: Lang): void {
  lang = next;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const table = lang === 'zh' ? ZH : EN;
  let text = table[key] ?? EN[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

const EN: Record<string, string> = {
  help: `gai - AI-planned git add + commit (works with any OpenAI-compatible API)

Usage:
  gai [options] [dir]        plan the uncommitted changes under dir (default: .) and commit them in groups
  gai config                 open the settings screen; a selection is saved and applied immediately
  gai update                 self-update to the latest release
  gai -v, --version          print version
  gai -h, --help             show this help

Options:
  -token, --token <key>      API token (prefer GAI_TOKEN: argv is visible in ps and shell history)
  -model, --model <name>     model name, e.g. deepseek-chat or gpt-4o-mini
  -base-url, --base-url <url>   OpenAI-compatible API base URL (default: https://api.openai.com/v1)
  -y, --yes                  skip the confirmation prompt
  --dry-run                  print the commit plan without committing
  --config <path>            KEY=VALUE config file (default: ~/.config/gai/config.env)

Configuration (flag > env > config file; every key is editable in gai config):
  token            GAI_TOKEN                    API token (legacy: AI_API_KEY)
  model            GAI_MODEL                    model name (legacy: AI_MODEL)
  base url         GAI_BASE_URL                 API base URL (legacy: AI_BASE_URL)
  interface lang   GAI_LANG                     en | zh
  commit language  GAI_COMMIT_LANG              en | zh
  commit types     GAI_COMMIT_TYPES             comma list, e.g. feat,fix,docs,refactor
  message pattern  GAI_COMMIT_PATTERN           message regex with the named groups type, scope,
                                               breaking, description (default: Conventional
                                               Commits header)
  scope            GAI_COMMIT_SCOPE             1 allow "type(scope): subject" (default 1)
  scope whitelist  GAI_COMMIT_SCOPES            comma list of allowed scopes; empty = any scope
  emoji            GAI_COMMIT_EMOJI             1 prefix the subject with the type emoji, e.g.
                                               feat: ✨ subject; not counted in the subject
                                               limit (default 0)
  body             GAI_COMMIT_BODY              1 require a body after a blank line (default 0)
  subject limit    GAI_COMMIT_SUBJECT_MAX       50 | 72 | 100 (default 72)
  ticket pattern   GAI_COMMIT_TICKET            regex, e.g. PROJ-[0-9]+; appends a "Refs: <ticket>"
                                               footer taken from the branch name or GAI_TICKET
  ticket required  GAI_COMMIT_TICKET_REQUIRED   1 fail when no ticket matches (default 0)
  GAI_YES=1 is equivalent to -y.

Commit message format (Conventional Commits):
  type(scope): subject        # subject is imperative, <= subject limit, no trailing period
  feat(ui): ✨ subject        # GAI_COMMIT_EMOJI=1 prepends the type emoji to the subject
                              # body (when enabled) follows one blank line and explains why
  BREAKING CHANGE: <note>     # footer for breaking changes
  Refs: <ticket>              # footer added by gai from the branch name

Quick start:
  gai config                  set token, model, language, and commit rules
  gai`,

  analyzing: 'Analyzing changes...',
  model_line: 'Model: {model}',
  commit_plan: 'Commit plan:',
  dry_run: 'Dry run: no commits created.',
  proceed: 'Proceed? [y/N] ',
  proceed_yes: 'Proceed? [y/N] y',
  aborted: 'Aborted.',
  done: 'Done.',
  no_changes: 'No changes under current directory: {scope}',
  files_changed: 'Changed file set has changed since the plan was generated. Run gai again.',

  not_a_repo: 'Not a git repository.',
  staged_existing: 'Existing staged changes detected. Commit or unstage them before running gai.',

  err_no_tty: 'The settings screen needs an interactive terminal (TTY).',
  err_cmd_failed: '{command} failed: {error}',
  err_option_value: 'Option {option} requires a value.\nRun gai -h for usage.',
  err_unknown_option: 'Unknown option: {arg}\nRun gai -h for usage.',
  err_unexpected_arg: 'Unexpected argument: {arg}\nRun gai -h for usage.',
  err_one_dir: 'Only one directory argument is allowed: {arg}\nRun gai -h for usage.',
  err_no_options: '{command} takes no options.',
  err_config_options: 'gai config only accepts --config <path>.',
  err_ticket_required:
    'GAI_COMMIT_TICKET_REQUIRED is set but the branch name carries no ticket matching GAI_COMMIT_TICKET.',
  upd_check_error: 'Release check failed: {error}',

  err_token_missing:
    'API token is missing. Set GAI_TOKEN, pass -token, or run "gai config".',
  err_model_missing: 'Model is not configured. Set GAI_MODEL, pass -model, or run "gai config".',
  err_config_missing: 'Config file not found: {path}',
  err_config_line: 'Invalid config line {file}:{line}: {text}',
  err_pattern_invalid: 'GAI_COMMIT_PATTERN is not a valid regex: {error}',
  err_pattern_groups: 'GAI_COMMIT_PATTERN must contain the named groups (?<type>), (?<scope>), (?<breaking>), (?<description>): {pattern}',
  err_ai_request: 'AI provider request failed: {error}',
  err_ai_status: 'AI provider returned HTTP {status}:\n{body}',
  err_ai_json: 'AI provider did not return JSON:\n{body}',
  err_ai_empty: 'AI provider returned empty content:\n{body}',

  plan_attempts: 'Commit plan validation failed (attempt {attempt}/{max}):',
  plan_fixing: 'Requesting a corrected plan...',
  plan_failed: 'AI provider failed to produce a valid commit plan after {max} attempts.\n\nLast validation error:\n{error}',

  val_no_json: 'AI did not return JSON:\n{raw}',
  val_parse_fail: 'Failed to parse plan JSON: {error}\n\nRaw output:\n{raw}',
  val_not_object: 'Plan JSON must be an object.',
  val_commits_array: 'Plan JSON must contain a non-empty "commits" array.',
  val_commit_object: 'Commit #{index} must be an object.',
  val_commit_message: 'Commit #{index} has an invalid message.',
  val_bad_format: 'Commit #{index} message does not follow the configured commit convention: {message}',
  val_bad_type: 'Commit #{index} uses a type outside GAI_COMMIT_TYPES: {message}',
  val_scope_disabled: 'Commit #{index} must not use a scope: {message}',
  val_scope_unknown: 'Commit #{index} scope is outside GAI_COMMIT_SCOPES: {message}',
  val_subject_emoji: 'Commit #{index} subject must not start with an emoji: {message}',
  val_subject_long: 'Commit #{index} subject exceeds {max} characters: {message}',
  val_subject_period: 'Commit #{index} subject must not end with a period: {message}',
  val_body_missing: 'Commit #{index} must include a body after a blank line: {message}',
  val_files_empty: 'Commit #{index} must contain a non-empty files array.',
  val_path_string: 'File paths in AI output must be strings.',
  val_path_empty: 'Empty file path in AI output.',
  val_path_abs: 'Absolute paths are not allowed in AI output: {path}',
  val_path_invalid: 'Invalid file path in AI output: {path}',
  val_unknown_file: 'AI returned a file that is not in current git status: {file}\n\nCommit: #{index}\n\nCurrent git status files:\n{files}',
  val_duplicate_file: 'File appears in multiple commits: {file} (commit #{a} and commit #{b})',
  val_missing_files: 'Plan did not cover every changed file:\n{files}',
  val_attempt_failed: 'Validation failed:\n{error}',

  upd_source_build: 'Running from source ({path}); self-update only works with a compiled gai binary.',
  upd_no_repo: 'Update source is not configured for this build.\nSet GAI_UPDATE_REPO=<owner>/<repo>, or build from a checkout whose git remote origin is the GitHub repo.',
  upd_current: 'Current: gai {version} ({asset})',
  upd_checking: 'Checking {repo} for updates...',
  upd_no_releases: 'No releases found for {repo}.\nPublish a GitHub release with a {asset} asset plus checksums.txt to enable gai update.',
  upd_check_failed: 'Release check failed (HTTP {status}):\n{body}',
  upd_bad_payload: 'Release API returned an unexpected payload.',
  upd_up_to_date: 'Already up to date (gai {version}, latest {tag}).',
  upd_bad_tag: 'Cannot parse release tag: {tag}',
  upd_no_asset: 'Release {tag} has no asset named {asset}.\nAvailable: {list}',
  upd_no_checksums: 'Release {tag} has no checksums.txt; refusing to install an unverified binary.',
  upd_sum_failed: 'Failed to download checksums.txt (HTTP {status}).',
  upd_sum_download: 'Failed to download checksums.txt: {error}',
  upd_sum_missing: 'checksums.txt has no entry for {asset}.',
  upd_no_write: 'No write permission for {dir}.\nRe-run with sudo or install manually.',
  upd_downloading: 'Downloading gai {tag} ({asset})...',
  upd_download_failed: 'Download failed (HTTP {status}).',
  upd_download: 'Download failed: {error}',
  upd_hash_mismatch: 'Checksum mismatch for {asset}: expected {expected}, got {actual}.',
  upd_parked_old: 'Previous binary kept at {path}; delete it once verified.',
  upd_replace_failed: 'Cannot replace {path}: {error}\nIf it lives in a system directory, re-run with sudo or install manually.',
  upd_done: 'Updated gai {from} -> {to}.',

  cfg_title: 'gai config',
  cfg_path: 'config file',
  cfg_hint: '↑/↓ select   ←/→ or Enter change (applies immediately)   q quit',
  cfg_saved: 'saved to {path}',
  cfg_saved_lang: 'saved to {path} · interface language applied',
  cfg_edit_hint: 'type a value · Enter save · Esc cancel',
  cfg_back_hint: 'Space toggle (applies immediately)   Esc back',
  cfg_not_set: '(not set)',
  cfg_any: '(any)',
  cfg_default: '(default)',
  cfg_masked: '(hidden)',
  cfg_env_note: '{key} in the environment overrides this file',
  cfg_bad_value: 'Invalid value: {value}',
  cfg_need_one_type: 'At least one commit type must stay enabled.',
  cfg_bad_ticket: 'Ticket pattern is not a valid regex: {error}',
  cfg_row_lang: 'Interface language',
  cfg_row_commit_lang: 'Commit message language',
  cfg_row_model: 'Model',
  cfg_row_token: 'API token',
  cfg_row_base_url: 'API base URL',
  cfg_row_types: 'Commit types',
  cfg_row_pattern: 'Message pattern',
  cfg_row_scope: 'Allow type(scope)',
  cfg_row_scopes: 'Scope whitelist',
  cfg_row_emoji: 'Emoji prefix',
  cfg_row_body: 'Require body',
  cfg_row_subject_max: 'Subject max length',
  cfg_row_ticket: 'Ticket pattern (Refs footer)',
  cfg_row_ticket_required: 'Ticket required',
  cfg_types_title: 'Commit types (GAI_COMMIT_TYPES)',
  cfg_yes: 'y',
  cfg_no: 'n',
};

const ZH: Record<string, string> = {
  help: `gai - AI 规划的 git add + commit（兼容任意 OpenAI 风格 API）

用法：
  gai [选项] [目录]          规划当前目录（默认 .）下的未提交改动，并分组提交
  gai config                 打开设置界面；选中即保存并立即生效
  gai update                 自更新到最新版本
  gai -v, --version          输出版本
  gai -h, --help             显示帮助

选项：
  -token, --token <key>      API token（推荐 GAI_TOKEN：命令行参数会出现在 ps 与历史记录中）
  -model, --model <name>     模型名，例如 deepseek-chat 或 gpt-4o-mini
  -base-url, --base-url <url>   OpenAI 风格 API 地址（默认 https://api.openai.com/v1）
  -y, --yes                  跳过确认
  --dry-run                  只打印提交计划，不真正提交
  --config <path>            KEY=VALUE 配置文件（默认 ~/.config/gai/config.env）

配置（优先级：命令行 > 环境变量 > 配置文件；所有配置都可在 gai config 中修改）：
  token            GAI_TOKEN                    API token（兼容 AI_API_KEY）
  model            GAI_MODEL                    模型名（兼容 AI_MODEL）
  base url         GAI_BASE_URL                 API 地址（兼容 AI_BASE_URL）
  界面语言          GAI_LANG                     en | zh
  提交信息语言       GAI_COMMIT_LANG              en | zh
  提交类型          GAI_COMMIT_TYPES             逗号分隔，如 feat,fix,docs,refactor
  消息正则          GAI_COMMIT_PATTERN           提交信息正则，须含命名分组 type、scope、
                                               breaking、description（默认即 Conventional
                                               Commits 格式）
  scope            GAI_COMMIT_SCOPE             1 允许 "type(scope): 摘要"（默认 1）
  scope 白名单      GAI_COMMIT_SCOPES            逗号分隔的 scope 白名单；留空表示不限
  emoji 前缀        GAI_COMMIT_EMOJI             1 在摘要前加类型对应 emoji，如 feat: ✨ 摘要；
                                               不计入长度校验（默认 0）
  正文              GAI_COMMIT_BODY              1 要求空行后有正文说明动机（默认 0）
  摘要长度          GAI_COMMIT_SUBJECT_MAX       50 | 72 | 100（默认 72）
  单号规则          GAI_COMMIT_TICKET            正则，如 PROJ-[0-9]+；从分支名或 GAI_TICKET 取值，
                                               为每个提交追加 "Refs: <单号>" footer
  必须有单号         GAI_COMMIT_TICKET_REQUIRED   1 匹配不到单号时直接失败（默认 0）
  GAI_YES=1 等价于 -y。

提交信息格式（Conventional Commits，企业规范）：
  type(scope): 摘要            # 祈使句、不超过摘要长度上限、结尾不加句号
  feat(ui): ✨ 摘要            # GAI_COMMIT_EMOJI=1 时自动加类型对应 emoji
                               # 开启正文时，空行后写动机与改动说明
  BREAKING CHANGE: <说明>      # 破坏性变更 footer
  Refs: <单号>                 # gai 从分支名追加的 footer

快速开始：
  gai config                   设置 token、模型、语言与提交规范
  gai`,

  analyzing: '正在分析改动…',
  model_line: '模型：{model}',
  commit_plan: '提交计划：',
  dry_run: '演练结束：未创建任何提交。',
  proceed: '继续？[y/N] ',
  proceed_yes: '继续？[y/N] y',
  aborted: '已取消。',
  done: '完成。',
  no_changes: '当前目录下没有改动：{scope}',
  files_changed: '生成计划后改动文件集已变化，请重新运行 gai。',

  not_a_repo: '不是一个 git 仓库。',
  staged_existing: '检测到已暂存的改动，请先提交或取消暂存后再运行 gai。',

  err_no_tty: '设置界面需要交互式终端（TTY）。',
  err_cmd_failed: '{command} 失败：{error}',
  err_option_value: '选项 {option} 需要一个值。\n运行 gai -h 查看用法。',
  err_unknown_option: '未知选项：{arg}\n运行 gai -h 查看用法。',
  err_unexpected_arg: '意外的参数：{arg}\n运行 gai -h 查看用法。',
  err_one_dir: '只能指定一个目录参数：{arg}\n运行 gai -h 查看用法。',
  err_no_options: '{command} 不接受额外选项。',
  err_config_options: 'gai config 只接受 --config <path>。',
  err_ticket_required: '已设置 GAI_COMMIT_TICKET_REQUIRED，但分支名中没有匹配 GAI_COMMIT_TICKET 的单号。',
  upd_check_error: '检查版本失败：{error}',

  err_token_missing: '缺少 API token。请设置 GAI_TOKEN、使用 -token，或运行 gai config。',
  err_model_missing: '未配置模型。请设置 GAI_MODEL、使用 -model，或运行 gai config。',
  err_config_missing: '找不到配置文件：{path}',
  err_config_line: '配置文件 {file} 第 {line} 行无效：{text}',
  err_pattern_invalid: 'GAI_COMMIT_PATTERN 不是有效的正则：{error}',
  err_pattern_groups: 'GAI_COMMIT_PATTERN 必须包含命名分组 (?<type>)、(?<scope>)、(?<breaking>)、(?<description>)：{pattern}',
  err_ai_request: 'AI 服务请求失败：{error}',
  err_ai_status: 'AI 服务返回 HTTP {status}：\n{body}',
  err_ai_json: 'AI 服务没有返回 JSON：\n{body}',
  err_ai_empty: 'AI 服务返回了空内容：\n{body}',

  plan_attempts: '提交计划校验失败（第 {attempt}/{max} 次）：',
  plan_fixing: '正在请求修正后的计划…',
  plan_failed: '{max} 次尝试后 AI 仍无法产出有效的提交计划。\n\n最后一次校验错误：\n{error}',

  val_no_json: 'AI 没有返回 JSON：\n{raw}',
  val_parse_fail: '解析计划 JSON 失败：{error}\n\n原始输出：\n{raw}',
  val_not_object: '计划 JSON 必须是对象。',
  val_commits_array: '计划 JSON 必须包含非空的 "commits" 数组。',
  val_commit_object: '提交 #{index} 必须是对象。',
  val_commit_message: '提交 #{index} 的 message 无效。',
  val_bad_format: '提交 #{index} 的 message 不符合当前提交规范：{message}',
  val_bad_type: '提交 #{index} 的 type 不在 GAI_COMMIT_TYPES 中：{message}',
  val_scope_disabled: '提交 #{index} 不允许使用 scope：{message}',
  val_scope_unknown: '提交 #{index} 的 scope 不在 GAI_COMMIT_SCOPES 白名单：{message}',
  val_subject_emoji: '提交 #{index} 的摘要不能以 emoji 开头：{message}',
  val_subject_long: '提交 #{index} 的摘要超过 {max} 个字符：{message}',
  val_subject_period: '提交 #{index} 的摘要结尾不能是句号：{message}',
  val_body_missing: '提交 #{index} 缺少空行后的正文：{message}',
  val_files_empty: '提交 #{index} 必须包含非空的 files 数组。',
  val_path_string: 'AI 输出的文件路径必须是字符串。',
  val_path_empty: 'AI 输出了空文件路径。',
  val_path_abs: 'AI 输出不允许绝对路径：{path}',
  val_path_invalid: 'AI 输出的文件路径无效：{path}',
  val_unknown_file: 'AI 返回了不在当前 git status 中的文件：{file}\n\n提交：#{index}\n\n当前 git status 文件：\n{files}',
  val_duplicate_file: '文件出现在多个提交中：{file}（提交 #{a} 与提交 #{b}）',
  val_missing_files: '计划没有覆盖全部改动文件：\n{files}',
  val_attempt_failed: '校验失败：\n{error}',

  upd_source_build: '当前以源码方式运行（{path}）；自更新只适用于编译后的 gai 二进制。',
  upd_no_repo: '此构建未配置更新源。\n请设置 GAI_UPDATE_REPO=<owner>/<repo>，或在 git remote origin 指向 GitHub 仓库的检出中构建。',
  upd_current: '当前：gai {version}（{asset}）',
  upd_checking: '正在检查 {repo} 的新版本…',
  upd_no_releases: '{repo} 没有发布版本。\n发布带 {asset} 资产与 checksums.txt 的 GitHub release 后即可使用 gai update。',
  upd_check_failed: '检查版本失败（HTTP {status}）：\n{body}',
  upd_bad_payload: 'Release API 返回了意外的数据。',
  upd_up_to_date: '已是最新（gai {version}，最新 {tag}）。',
  upd_bad_tag: '无法解析 release tag：{tag}',
  upd_no_asset: 'release {tag} 没有名为 {asset} 的资产。\n可用资产：{list}',
  upd_no_checksums: 'release {tag} 没有 checksums.txt，拒绝安装未经校验的二进制。',
  upd_sum_failed: '下载 checksums.txt 失败（HTTP {status}）。',
  upd_sum_download: '下载 checksums.txt 失败：{error}',
  upd_sum_missing: 'checksums.txt 中没有 {asset} 的条目。',
  upd_no_write: '没有 {dir} 的写权限。\n请用 sudo 重试或手动安装。',
  upd_downloading: '正在下载 gai {tag}（{asset}）…',
  upd_download_failed: '下载失败（HTTP {status}）。',
  upd_download: '下载失败：{error}',
  upd_hash_mismatch: '{asset} 校验和不匹配：期望 {expected}，实际 {actual}。',
  upd_parked_old: '旧版本保留在 {path}，确认无误后可删除。',
  upd_replace_failed: '无法替换 {path}：{error}\n如果位于系统目录，请用 sudo 重试或手动安装。',
  upd_done: '已更新 gai {from} -> {to}。',

  cfg_title: 'gai 设置',
  cfg_path: '配置文件',
  cfg_hint: '↑/↓ 选择   ←/→ 或回车 修改（立即生效）   q 退出',
  cfg_saved: '已保存到 {path}',
  cfg_saved_lang: '已保存到 {path} · 界面语言已切换',
  cfg_edit_hint: '输入内容 · 回车保存 · Esc 取消',
  cfg_back_hint: '空格切换（立即生效）   Esc 返回',
  cfg_not_set: '（未设置）',
  cfg_any: '（不限）',
  cfg_default: '（默认）',
  cfg_masked: '（已隐藏）',
  cfg_env_note: '环境变量 {key} 优先于此文件',
  cfg_bad_value: '无效的值：{value}',
  cfg_need_one_type: '至少保留一种提交类型。',
  cfg_bad_ticket: '单号规则不是合法正则：{error}',
  cfg_row_lang: '界面语言',
  cfg_row_commit_lang: '提交信息语言',
  cfg_row_model: '模型',
  cfg_row_token: 'API token',
  cfg_row_base_url: 'API 地址',
  cfg_row_types: '提交类型',
  cfg_row_pattern: '消息正则',
  cfg_row_scope: '允许 type(scope)',
  cfg_row_scopes: 'scope 白名单',
  cfg_row_emoji: 'emoji 前缀',
  cfg_row_body: '要求正文',
  cfg_row_subject_max: '摘要长度上限',
  cfg_row_ticket: '单号规则（Refs footer）',
  cfg_row_ticket_required: '必须有单号',
  cfg_types_title: '提交类型（GAI_COMMIT_TYPES）',
  cfg_yes: '是',
  cfg_no: '否',
};
