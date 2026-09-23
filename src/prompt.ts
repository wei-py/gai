import { Convention } from './config';
import { Lang } from './i18n';

export interface PromptInput {
  cwd: string;
  repoRoot: string;
  scopeLabel: string;
  files: string[];
  status: Map<string, string>;
  trackedDiff: string;
  trackedDiffTruncated: boolean;
  untrackedPreview: string;
  convention: Convention;
  commitLang: Lang;
}

// Commit message rules restated for the model; must stay in lockstep with checkMessage in plan.ts.
function rulesBlock(convention: Convention, commitLang: Lang): string {
  const { types, scope, body, subjectMax } = convention;
  const lines: string[] = [];

  if (commitLang === 'zh') {
    lines.push('提交信息规范（Conventional Commits）：');
    lines.push('- message 语言必须是中文');
    lines.push('- 格式：type(scope): 摘要；破坏性变更写成 type!: 摘要 或 type(scope)!: 摘要');
    lines.push(`- type 只能是：${types.join(', ')}`);
    lines.push(
      scope
        ? '- scope 可选：能明确模块时使用，例如 feat(ui): ...；无法确定就省略 scope，写成 feat: ...'
        : '- 不要使用 scope，格式固定为 type: 摘要',
    );
    lines.push(`- 摘要：简短祈使句，首行（含 type 与 scope）不超过 ${subjectMax} 个字符，结尾不加句号`);
    if (body) {
      lines.push('- 每个提交在摘要后空一行写正文，说明改动动机与影响，每行不超过 72 个字符');
    }
    lines.push('- 破坏性变更：type/scope 后加 !，并在正文后加一行 "BREAKING CHANGE: 说明"');
  } else {
    lines.push('Commit message rules (Conventional Commits):');
    lines.push('- write every message in English');
    lines.push('- format: type(scope): subject; for breaking changes use type!: subject or type(scope)!: subject');
    lines.push(`- type must be one of: ${types.join(', ')}`);
    lines.push(
      scope
        ? '- scope is optional: use it when the module is clear, e.g. feat(ui): ...; otherwise omit it, e.g. feat: ...'
        : '- never use a scope; the format is type: subject',
    );
    lines.push(
      `- subject: short imperative sentence, first line (with type and scope) at most ${subjectMax} characters, no trailing period`,
    );
    if (body) {
      lines.push('- every commit needs a body after one blank line: motivation and impact, at most 72 characters per line');
    }
    lines.push('- breaking changes: add ! after type/scope and a "BREAKING CHANGE: <note>" line after the body');
  }
  return lines.join('\n');
}

function schemaLine(convention: Convention): string {
  const shape = convention.body ? 'type(scope): subject\\n\\nbody' : 'type(scope): subject';
  return `{"commits":[{"message":"${shape}","files":["path/from/repo/root"]}]}`;
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
  convention,
  commitLang,
}: PromptInput): string {
  const fileList = files.map((file) => `- ${file} [${status.get(file)}]`).join('\n');
  const truncationNote = trackedDiffTruncated
    ? commitLang === 'zh'
      ? 'Tracked diff 被截断，内容较大。请根据文件名与可见 diff 上下文保守分组。'
      : 'The tracked diff was truncated because it is large. Group conservatively using filenames and visible diff context.'
    : commitLang === 'zh'
      ? 'Tracked diff 是完整的。'
      : 'The tracked diff is complete.';

  const rules = rulesBlock(convention, commitLang);

  const header =
    commitLang === 'zh'
      ? `你是 Git 提交拆分规划器。

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
- 只输出一个 JSON object`
      : `You are a Git commit splitting planner.

Goal: split the uncommitted changes under the current directory tree into commit groups by feature or purpose.

Hard requirements:
- only handle the current directory tree; never include files from other parts of the repository
- group at file level; one file may appear in exactly one commit, never twice
- every changed file must be covered exactly once, never missed
- the sum of files across all commits must equal the changed file count: ${files.length}
- files may only use paths from the "changed files" list below; never use paths mentioned inside diff content
- before answering, check the complete file list below for omissions and duplicates
- merge related files by feature; pages, APIs, state, tools, and their tests belong in one commit
- do not create one commit per file unless the changes are truly independent
- the number of commits is unlimited; split by feature and purpose
- output no markdown, explanation, comments, or code fences
- output exactly one JSON object`;

  return `${header}

${rules}

JSON schema：
${schemaLine(convention)}

${commitLang === 'zh' ? '当前工作目录' : 'Working directory'}：${cwd}
${commitLang === 'zh' ? 'Git 仓库根目录' : 'Git repository root'}：${repoRoot}
${commitLang === 'zh' ? '处理范围' : 'Scope'}：${scopeLabel}

${commitLang === 'zh' ? '改动文件总数' : 'Changed file count'}：${files.length}

${commitLang === 'zh' ? '当前 git status 改动文件' : 'Changed files from git status'}：
${fileList}

${commitLang === 'zh' ? 'Diff 状态' : 'Diff status'}：${truncationNote}

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
  convention,
  commitLang,
}: {
  files: string[];
  status: Map<string, string>;
  validationError: string;
  convention: Convention;
  commitLang: Lang;
}): string {
  const fileList = files.map((file) => `- ${file} [${status.get(file)}]`).join('\n');
  const rules = rulesBlock(convention, commitLang);

  const header =
    commitLang === 'zh'
      ? `你上一次生成的 Git 提交计划未通过确定性校验。

校验错误：
${validationError}

请根据完整对话中的原始改动和上一版计划重新生成计划。只输出修复后的 JSON object，不要输出 markdown、解释、注释或代码块。

硬性要求：
- 每个文件必须且只能出现一次
- 不得遗漏文件，不得添加列表外的文件
- 所有 files 数量之和必须等于 ${files.length}
- 按业务功能合并页面、接口、状态、工具和对应测试，不要按文件逐个创建 commit
- commit 数量不设上限；以业务功能和目的决定拆分粒度`
      : `Your previous Git commit plan failed deterministic validation.

Validation error:
${validationError}

Regenerate the plan from the original changes and the previous plan in this conversation. Output only the corrected JSON object, with no markdown, explanation, comments, or code fences.

Hard requirements:
- every file appears exactly once
- never miss a file, never add files outside the list
- the sum of files across commits must equal ${files.length}
- merge pages, APIs, state, tools, and their tests by feature; do not create one commit per file
- the number of commits is unlimited; split by feature and purpose`;

  return `${header}

${rules}

JSON schema：
${schemaLine(convention)}

${commitLang === 'zh' ? '必须覆盖的完整文件列表' : 'Complete file list that must be covered'}：
${fileList}
`;
}
