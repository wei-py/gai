export interface PromptInput {
  cwd: string;
  repoRoot: string;
  scopeLabel: string;
  files: string[];
  status: Map<string, string>;
  trackedDiff: string;
  trackedDiffTruncated: boolean;
  untrackedPreview: string;
}

export function buildPrompt({
  cwd,
  repoRoot,
  scopeLabel,
  files,
  status,
  trackedDiff,
  trackedDiffTruncated,
  untrackedPreview,
}: PromptInput): string {
  const fileList = files.map((file) => `- ${file} [${status.get(file)}]`).join('\n');
  const truncationNote = trackedDiffTruncated
    ? 'Tracked diff was truncated because it is large. Use filenames and visible diff context to group conservatively.'
    : 'Tracked diff is complete.';

  return `你是 Git 提交拆分规划器。

目标：把当前目录树的未提交改动按功能/目的拆成多个提交计划。

硬性要求：
- 只处理当前目录树，不要包含仓库其他目录的文件
- 只做文件级分组；同一个文件只能出现在一个 commit 中，绝对不能重复
- 每个改动文件必须且只能被覆盖一次，绝对不能遗漏
- 所有 commits 的 files 数量之和必须等于改动文件总数：${files.length}
- files 只能使用下面“当前 git status 改动文件”列表中的路径；不要使用 diff 内容里提到的其他路径
- 输出前逐项核对下面的完整文件列表，确认无遗漏、无重复
- 按业务功能合并相关文件；页面、接口、状态、工具和对应测试应尽量放在同一个 commit
- 不要按文件逐个创建 commit；除非文件确实是完全独立的改动
- commit 数量不设上限；以业务功能和目的决定拆分粒度
- 不要输出 markdown、解释、注释或代码块
- 只输出一个 JSON object
- commit message 使用中文 Conventional Commits 风格
- message 格式必须是：type(scope): 中文摘要
- scope 可选；如果无法确定清晰 scope，就使用：type: 中文摘要
- type 只能是：feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- 中文摘要使用简短祈使句，末尾不要加句号

JSON schema：
{"commits":[{"message":"type(scope): 中文摘要","files":["path/from/repo/root"]}]}

当前工作目录：${cwd}
Git 仓库根目录：${repoRoot}
处理范围：${scopeLabel}

改动文件总数：${files.length}

当前 git status 改动文件：
${fileList}

Diff 状态：${truncationNote}

Tracked diff:
${trackedDiff || '[no tracked diff]'}

Untracked file previews:
${untrackedPreview || '[no untracked files]'}
`;
}

export function buildRepairPrompt({
  files,
  status,
  validationError,
}: {
  files: string[];
  status: Map<string, string>;
  validationError: string;
}): string {
  const fileList = files.map((file) => `- ${file} [${status.get(file)}]`).join('\n');

  return `你上一次生成的 Git 提交计划未通过确定性校验。

校验错误：
${validationError}

请根据完整对话中的原始改动和上一版计划重新生成计划。只输出修复后的 JSON object，不要输出 markdown、解释、注释或代码块。

硬性要求：
- JSON schema：{"commits":[{"message":"type(scope): 中文摘要","files":["path/from/repo/root"]}]}
- 每个文件必须且只能出现一次
- 同一个文件绝对不能出现在多个 commit 中
- 不得遗漏文件，不得添加列表外的文件
- 所有 files 数量之和必须等于 ${files.length}
- 按业务功能合并页面、接口、状态、工具和对应测试，不要按文件逐个创建 commit
- commit 数量不设上限；以业务功能和目的决定拆分粒度
- commit message 必须保持中文 Conventional Commits 格式

必须覆盖的完整文件列表：
${fileList}
`;
}
