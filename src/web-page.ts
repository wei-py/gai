import { DEFAULT_TYPES } from './config';
import { COMMIT_TEMPLATES } from './commit-templates';
import { WEB_I18N } from './web-i18n';

/** Self-contained local settings UI; no runtime assets or package-relative files. */
export function renderWebPage(secret: string): string {
  const token = JSON.stringify(secret).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="referrer" content="no-referrer">
  <title data-i18n="pageTitle">gai · 本机配置</title>
  <script>
    (function () {
      let preference = 'system';
      try { const saved = localStorage.getItem('gai.web.theme'); if (['system', 'light', 'dark'].includes(saved)) preference = saved; } catch {}
      const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.dataset.themePreference = preference;
    })();
  </script>
  <style>
    :root { color-scheme:light; --bg:#fff; --surface:#fff; --text:#171918; --muted:#686f6b; --border:#e0e3e1; --accent:#171918; --soft:#f1f3f1; --error:#a13832; --success:#285f47; --warning:#755515; }
    * { box-sizing:border-box; }
    html { scroll-padding-bottom:140px; }
    body { margin:0; font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; background:var(--bg); color:var(--text); -webkit-font-smoothing:antialiased; }
    main { max-width:1360px; margin:auto; padding:40px 40px 28px; }
    header { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:24px; }
    header > div { min-width:0; }
    .brand { margin:0 0 6px; color:var(--muted); font:12px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace; letter-spacing:.04em; }
    h1 { margin:0; font-size:28px; font-weight:500; line-height:1.3; letter-spacing:-.025em; }
    h2 { margin:0; font-size:17px; font-weight:500; line-height:1.4; }
    p { margin:8px 0 0; }
    .muted, .help { color:var(--muted); }
    .local-badge { flex-shrink:0; border:1px solid var(--border); padding:3px 8px; font-size:12px; color:var(--muted); }
    .header-tools { display:flex; flex-wrap:wrap; justify-content:flex-end; align-items:flex-end; gap:12px; }
    .header-tools label { font-size:12px; color:var(--muted); }
    .header-tools select { width:auto; min-width:100px; }
    .header-tools .local-badge { align-self:center; }
    .settings-layout { display:grid; grid-template-columns:minmax(0,1fr) 140px; column-gap:48px; align-items:start; }
    .settings-layout > form { grid-column:1; grid-row:1; }
    .context { border-block:1px solid var(--border); padding:12px 0; margin-bottom:16px; }
    .path-label { color:var(--muted); font-size:12px; font-weight:400; }
    #config-path { display:block; overflow-wrap:anywhere; margin-top:4px; font-size:13px; }
    #env-summary { color:var(--warning); margin-top:8px; overflow-wrap:anywhere; }
    nav { grid-column:2; grid-row:1; position:sticky; top:24px; display:flex; flex-direction:column; gap:10px; padding:16px 0 0 16px; border-left:1px solid var(--border); }
    .nav-title { margin:0 0 4px; color:var(--muted); font-size:12px; font-weight:400; }
    nav a { color:var(--muted); text-decoration:none; font-size:14px; overflow-wrap:anywhere; }
    nav a:hover { color:var(--text); text-decoration:underline; text-underline-offset:3px; }
    nav a[aria-current=location] { color:var(--text); font-weight:500; }
    form, fieldset { min-width:0; min-inline-size:0; }
    #all-fields { padding:0; margin:0; border:0; counter-reset:settings; }
    .card { display:grid; grid-template-columns:156px minmax(0,1fr); gap:32px; margin:0; padding:36px 0; border:0; border-top:1px solid var(--border); background:var(--surface); scroll-margin-top:20px; counter-increment:settings; }
    .section-heading { margin:0; }
    .section-heading h2::before { content:"0" counter(settings); display:block; margin-bottom:10px; color:var(--muted); font:12px/1.5 ui-monospace,monospace; }
    .section-heading p { margin-top:10px; font-size:12px; color:var(--muted); line-height:1.8; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:24px; align-content:start; }
    .wide { grid-column:1/-1; }
    .field { min-width:0; }
    label, .field-title { display:block; margin-bottom:6px; font-size:14px; font-weight:500; }
    input:not([type=checkbox]), select, textarea { display:block; width:100%; min-width:0; min-height:40px; border:1px solid var(--border); border-radius:0; padding:8px 10px; font:inherit; font-size:14px; background:var(--surface); color:var(--text); }
    select { appearance:none; padding-right:34px; cursor:pointer; background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%); background-position:calc(100% - 17px) 17px,calc(100% - 12px) 17px; background-size:5px 5px; background-repeat:no-repeat; }
    select:hover:not(:disabled), select:open { border-color:var(--text); }
    select option { background:var(--surface); color:var(--text); }
    /* Style the native picker where supported; older engines retain their accessible OS menu. */
    @supports (appearance:base-select) {
      select, select::picker(select) { appearance:base-select; }
      select { display:flex; background-image:none; padding:8px 12px; align-items:center; gap:16px; }
      select::picker-icon { content:""; width:7px; height:7px; margin-left:auto; margin-right:2px; border-right:1px solid currentColor; border-bottom:1px solid currentColor; transform:translateY(-2px) rotate(45deg); color:var(--muted); }
      select:open::picker-icon { transform:translateY(2px) rotate(225deg); }
      select::picker(select) { min-inline-size:anchor-size(width); max-inline-size:calc(100vw - 32px); max-block-size:min(320px,70dvh); margin-block:4px; padding:4px; border:1px solid var(--border); border-radius:0; background:var(--surface); color:var(--text); box-shadow:none; font:inherit; scrollbar-width:thin; }
      select option { display:flex; align-items:center; gap:16px; min-block-size:36px; padding:8px 10px; border:0; border-radius:0; font-size:14px; line-height:1.5; white-space:normal; overflow-wrap:anywhere; cursor:pointer; }
      select option:checked { background:var(--soft); box-shadow:inset 2px 0 var(--text); }
      select option:hover:not(:disabled), select option:focus-visible { background:var(--soft); color:var(--text); outline:1px solid var(--text); outline-offset:-1px; }
      select option::checkmark { order:1; margin-left:auto; color:var(--text); }
      select option:disabled { color:var(--muted); cursor:not-allowed; }
    }
    textarea { resize:vertical; min-height:80px; line-height:1.6; }
    .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace !important; }
    input:disabled, select:disabled, textarea:disabled { background:var(--soft); color:var(--muted); opacity:1; cursor:not-allowed; }
    :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .help, .env-note { display:block; margin:6px 0 0; font-size:12px; font-weight:400; line-height:1.6; overflow-wrap:anywhere; }
    .env-note { color:var(--warning); }
    .token-row, .custom-type-row { display:flex; gap:8px; align-items:stretch; }
    .token-row input, .custom-type-row input { min-width:0; flex:1; }
    button { border:1px solid var(--border); border-radius:0; background:var(--surface); color:var(--text); padding:7px 12px; font:inherit; font-size:14px; font-weight:400; cursor:pointer; }
    button:hover:not(:disabled) { border-color:var(--text); background:var(--soft); }
    button:disabled { opacity:.4; cursor:not-allowed; }
    #toggle-token, #add-type { flex-shrink:0; white-space:nowrap; }
    .check { display:flex; align-items:flex-start; gap:10px; margin:0; cursor:pointer; }
    .check input, .type-option input { width:16px; height:16px; margin:3px 0 0; accent-color:var(--accent); flex-shrink:0; }
    .check span { min-width:0; }
    .check strong { display:block; font-size:14px; font-weight:500; }
    .check .help { margin-top:3px; }
    #types { padding:0; margin:0; border:0; }
    .type-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 24px; padding:0; margin:12px 0; border:0; }
    #types > legend { padding:0; font-size:14px; font-weight:500; }
    .type-option { display:flex; align-items:center; gap:10px; min-width:0; min-height:42px; margin:0; padding:8px 0; border-bottom:1px solid var(--border); cursor:pointer; }
    .type-option > span { display:flex; align-items:baseline; flex-wrap:wrap; gap:4px 12px; min-width:0; overflow-wrap:anywhere; }
    .type-option strong { font:13px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace; min-width:62px; font-weight:500; }
    .type-option small { color:var(--muted); font-size:12px; font-weight:400; }
    .type-option:has(input:checked) strong { color:var(--text); }
    .type-option:hover:has(input:not(:disabled)) { background:var(--soft); }
    .type-option:has(input:disabled) { color:var(--muted); cursor:not-allowed; }
    .custom-type-row { margin-top:16px; max-width:420px; }
    #types-summary { margin-top:6px; font-size:12px; color:var(--muted); }
    .format-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:24px; align-items:start; }
    .format-preview { margin:0; padding:12px 16px; border-left:2px solid var(--border); background:var(--soft); font-size:12px; min-width:0; }
    .format-preview dt { color:var(--muted); margin:0 0 4px; }
    .format-preview dd { margin:0 0 12px; overflow-wrap:anywhere; }
    .format-preview dd:last-child { margin-bottom:0; }
    .pattern-editor { margin-top:24px; }
    #pattern { min-height:92px; font-size:12px; line-height:1.8; }
    #pattern-warning { margin-top:12px; color:var(--warning); }
    .subsection { border-top:1px solid var(--border); padding-top:24px; }
    .subsection-heading { margin:0; font-size:14px; font-weight:500; }
    .actions { position:sticky; bottom:0; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 0; border-top:1px solid var(--border); background:var(--surface); }
    .action-buttons { display:flex; gap:8px; flex-shrink:0; }
    #save { background:var(--text); border-color:var(--text); color:var(--surface); min-width:104px; }
    #save:hover:not(:disabled) { background:var(--surface); color:var(--text); }
    #status { min-width:0; margin:0; font-size:13px; overflow-wrap:anywhere; }
    #status[data-state=success] { color:var(--success); }
    #status[data-state=dirty] { color:var(--warning); }
    #error { margin:0 0 18px; padding:10px 12px; border:1px solid var(--error); color:var(--error); background:var(--surface); overflow-wrap:anywhere; white-space:pre-wrap; }
    footer { margin-top:16px; font-size:12px; color:var(--muted); }
    [hidden] { display:none !important; }
    :root[data-theme=dark] { color-scheme:dark; --bg:#171918; --surface:#171918; --text:#e9ece9; --muted:#a8afaa; --border:#3c433e; --accent:#e9ece9; --soft:#252a26; --error:#efa39d; --success:#91c9a9; --warning:#d4be8a; }
    @media (max-width:900px) {
      .settings-layout { display:flex; flex-direction:column; gap:0; }
      .settings-layout > form { width:100%; }
      nav { position:static; flex-direction:row; flex-wrap:wrap; gap:8px 20px; width:100%; margin:0 0 20px; padding:0; border:0; }
      .nav-title { flex-basis:100%; margin-bottom:0; }
    }
    @media (max-width:640px) {
      main { padding:24px 16px 20px; }
      header { flex-wrap:wrap; gap:12px; margin-bottom:20px; }
      h1 { font-size:26px; }
      .local-badge { font-size:11px; }
      .header-tools { justify-content:flex-start; width:100%; gap:12px; }
      .card { display:block; padding:28px 0; margin:0; }
      .section-heading { margin-bottom:24px; }
      .section-heading h2::before { display:inline; margin:0 12px 0 0; }
      .grid { grid-template-columns:minmax(0,1fr); gap:24px; }
      .format-layout { grid-template-columns:minmax(0,1fr); gap:16px; }
      .type-options { grid-template-columns:minmax(0,1fr); }
      .actions { align-items:stretch; flex-direction:column; gap:8px; padding:10px 0; }
      .action-buttons { justify-content:flex-end; }
      nav { gap:8px 18px; margin-bottom:16px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="brand" data-i18n="brand">GAI / 配置</p>
        <h1 data-i18n="title">本机配置</h1>
        <p class="muted" data-i18n="subtitle">配置 AI 连接和提交习惯，继续在终端中使用 gai。</p>
      </div>
      <div class="header-tools">
        <div><label for="theme-preference" data-i18n="theme">主题</label><select id="theme-preference"><option value="system" data-i18n="themeSystem">系统</option><option value="light" data-i18n="themeLight">浅色</option><option value="dark" data-i18n="themeDark">深色</option></select></div>
        <div><label for="page-language" data-i18n="pageLanguage">网页语言</label><select id="page-language"><option value="zh" data-i18n="pageChinese">中文</option><option value="en" data-i18n="pageEnglish">英文</option></select></div>
        <span class="local-badge" data-i18n="localOnly">仅本机访问</span>
      </div>
    </header>
    <section class="context" aria-label="配置来源" data-i18n-aria-label="source">
      <span class="path-label" data-i18n="configFile">配置文件</span>
      <code id="config-path">正在读取路径…</code>
      <p id="env-summary" hidden></p>
    </section>
    <noscript><p data-i18n="noScript">此配置页面需要启用 JavaScript。你也可以继续使用终端中的 gai config。</p></noscript>
    <p id="error" role="alert" hidden></p>
    <div class="settings-layout">
    <nav id="page-directory" aria-label="页内目录" data-i18n-aria-label="navigation">
      <h2 class="nav-title" data-i18n="navigation">页内目录</h2>
      <a href="#api" data-i18n="api" aria-current="location">API 连接</a><a href="#language" data-i18n="language">语言</a><a href="#convention" data-i18n="convention">提交规范</a><a href="#tickets" data-i18n="tickets">工单关联</a>
    </nav>
    <form id="settings-form" aria-busy="true">
      <fieldset id="all-fields" disabled aria-label="gai 配置项" data-i18n-aria-label="settings">
        <section id="api" class="card" tabindex="-1" aria-labelledby="api-heading">
          <div class="section-heading"><h2 id="api-heading" data-i18n="api">API 连接</h2><p data-i18n="apiHelp">使用兼容 OpenAI 的接口。Token 只会发送给本机配置服务，不会在此页面中调用模型。</p></div>
          <div class="grid">
            <div class="field wide">
              <label for="token" data-i18n="token">API Token</label>
              <div class="token-row"><input id="token" name="token" type="password" autocomplete="off" spellcheck="false" aria-describedby="token-help token-env"><button id="toggle-token" type="button" aria-controls="token" aria-pressed="false">显示</button></div>
              <small class="help" id="token-help" data-i18n="tokenHelp">留空可移除配置文件中的 Token。请勿分享此页面或屏幕中的凭据。</small>
              <small class="env-note" id="token-env" hidden></small>
            </div>
            <div class="field">
              <label for="model" data-i18n="model">模型名称</label>
              <input id="model" name="model" type="text" autocomplete="off" spellcheck="false" placeholder="例如 gpt-4.1-mini" data-i18n-placeholder="modelPlaceholder" aria-describedby="model-help model-env">
              <small class="help" id="model-help" data-i18n="modelHelp">填写服务商支持的模型 ID。</small><small class="env-note" id="model-env" hidden></small>
            </div>
            <div class="field">
              <label for="baseUrl" data-i18n="baseUrl">API Base URL</label>
              <input id="baseUrl" name="baseUrl" type="url" required autocomplete="off" spellcheck="false" placeholder="https://api.openai.com/v1" aria-describedby="baseUrl-help baseUrl-env">
              <small class="help" id="baseUrl-help" data-i18n="baseUrlHelp">兼容接口的基础地址，通常以 /v1 结尾。</small><small class="env-note" id="baseUrl-env" hidden></small>
            </div>
          </div>
        </section>
        <section id="language" class="card" tabindex="-1" aria-labelledby="language-heading">
          <div class="section-heading"><h2 id="language-heading" data-i18n="language">语言</h2><p data-i18n="languageHelp">终端界面与生成的提交消息可使用不同语言；网页语言由顶部选项独立控制，不写入配置文件。</p></div>
          <div class="grid">
            <div class="field"><label for="lang" data-i18n="lang">终端界面语言</label><select id="lang" name="lang" aria-describedby="lang-env"><option value="zh" data-i18n="chineseOption">中文 · zh</option><option value="en" data-i18n="englishOption">English · en</option></select><small class="env-note" id="lang-env" hidden></small></div>
            <div class="field"><label for="commitLang" data-i18n="commitLang">提交消息语言</label><select id="commitLang" name="commitLang" aria-describedby="commitLang-env"><option value="zh" data-i18n="chineseOption">中文 · zh</option><option value="en" data-i18n="englishOption">English · en</option></select><small class="env-note" id="commitLang-env" hidden></small></div>
          </div>
        </section>
        <section id="convention" class="card" tabindex="-1" aria-labelledby="convention-heading">
          <div class="section-heading"><h2 id="convention-heading" data-i18n="convention">提交规范</h2><p data-i18n="conventionHelp">控制提交消息的类型、格式、范围与内容。</p></div>
          <div class="grid">
            <div class="field wide">
              <fieldset id="types" aria-describedby="types-help types-env">
                <legend data-i18n="types">允许的提交类型</legend>
                <p id="types-summary" role="status"></p>
                  <div id="type-choices" class="type-options"></div>
                  <div class="custom-type-row"><input id="custom-type" type="text" autocomplete="off" spellcheck="false" aria-label="自定义提交类型" data-i18n-aria-label="customType" placeholder="自定义类型，例如 release" data-i18n-placeholder="customTypePlaceholder"><button id="add-type" type="button" data-i18n="addType">添加类型</button></div>
              </fieldset>
              <small class="help" id="types-help" data-i18n="typesHelp">勾选允许生成的类型，至少选择一项。自定义类型仅支持小写英文字母。</small><small class="env-note" id="types-env" hidden></small>
            </div>
            <div class="field wide subsection">
              <div class="format-layout">
                <div>
                  <label for="pattern-template" data-i18n="patternTemplate">提交格式模板</label>
                  <select id="pattern-template" aria-describedby="pattern-warning pattern-env"></select>
                  <small id="pattern-warning" class="help" data-i18n="templateWarning" hidden>非标准格式可能影响 Conventional Commits 生态工具。</small>
              <div class="pattern-editor">
                <label for="pattern" data-i18n="pattern">提交消息正则</label>
                <textarea id="pattern" name="pattern" class="mono" required rows="3" autocomplete="off" spellcheck="false" aria-describedby="pattern-help pattern-env"></textarea>
                <small class="help" id="pattern-help" data-i18n="patternHelp">保留四个命名捕获组。</small><small class="env-note" id="pattern-env" hidden></small>
              </div>
                </div>
                <dl class="format-preview" aria-label="格式示例" data-i18n-aria-label="formatPreview">
                  <dt data-i18n="previewScoped">带范围</dt><dd id="pattern-example" class="mono"></dd>
                  <dt data-i18n="previewUnscoped">无范围</dt><dd id="preview-unscoped" class="mono"></dd>
                  <dt data-i18n="previewBreaking">破坏性变更</dt><dd id="preview-breaking" class="mono"></dd>
                </dl>
              </div>
            </div>
            <h3 class="wide subsection subsection-heading" data-i18n="outputRules">输出规则</h3>
            <div class="field">
              <label for="subjectMax" data-i18n="subjectMax">提交标题最大长度</label>
              <input id="subjectMax" name="subjectMax" type="number" required min="1" max="300" step="1" inputmode="numeric" aria-describedby="subjectMax-help subjectMax-env">
              <small class="help" id="subjectMax-help" data-i18n="subjectMaxHelp">1–300 个字符；自动添加的类型 Emoji 不计入此限制。</small><small class="env-note" id="subjectMax-env" hidden></small>
            </div>
            <div class="field">
              <label for="scopes" data-i18n="scopes">允许的 scope</label>
              <input id="scopes" name="scopes" type="text" autocomplete="off" spellcheck="false" placeholder="例如 cli, api, docs" data-i18n-placeholder="scopesPlaceholder" aria-describedby="scopes-help scopes-env">
              <small class="help" id="scopes-help" data-i18n="scopesHelp">用英文逗号分隔；留空允许任意 scope。</small><small class="env-note" id="scopes-env" hidden></small>
            </div>
            <div class="field"><label class="check" for="scope"><input id="scope" name="scope" type="checkbox" aria-describedby="scope-env"><span><strong data-i18n="scope">启用 scope</strong><span class="help" data-i18n="scopeHelp">允许提交消息带上变更范围，如 feat(cli)。</span></span></label><small class="env-note" id="scope-env" hidden></small></div>
            <div class="field"><label class="check" for="emoji"><input id="emoji" name="emoji" type="checkbox" aria-describedby="emoji-env"><span><strong data-i18n="emoji">添加类型 Emoji</strong><span class="help" data-i18n="emojiHelp">在提交描述前添加对应类型的 Emoji。</span></span></label><small class="env-note" id="emoji-env" hidden></small></div>
            <div class="field wide"><label class="check" for="body"><input id="body" name="body" type="checkbox" aria-describedby="body-env"><span><strong data-i18n="body">生成提交正文</strong><span class="help" data-i18n="bodyHelp">在标题之外生成说明变更内容的正文。</span></span></label><small class="env-note" id="body-env" hidden></small></div>
          </div>
        </section>
        <section id="tickets" class="card" tabindex="-1" aria-labelledby="tickets-heading">
          <div class="section-heading"><h2 id="tickets-heading" data-i18n="tickets">工单关联</h2><p data-i18n="ticketsHelp">配置工单编号的匹配规则，以及是否要求提交关联工单。</p></div>
          <div class="grid">
            <div class="field wide"><label for="ticketPattern" data-i18n="ticketPattern">工单匹配正则</label><input id="ticketPattern" name="ticketPattern" class="mono" type="text" autocomplete="off" spellcheck="false" placeholder="例如 [A-Z]+-\\d+" data-i18n-placeholder="ticketPlaceholder" aria-describedby="ticketPattern-help ticketPattern-env"><small class="help" id="ticketPattern-help" data-i18n="ticketHelp">填写正则表达式源码（不要添加 / 分隔符）；留空不自定义工单匹配规则。</small><small class="env-note" id="ticketPattern-env" hidden></small></div>
            <div class="field wide"><label class="check" for="ticketRequired"><input id="ticketRequired" name="ticketRequired" type="checkbox" aria-describedby="ticketRequired-env"><span><strong data-i18n="ticketRequired">必须关联工单</strong><span class="help" data-i18n="ticketRequiredHelp">启用后，提交必须包含可识别的工单编号。</span></span></label><small class="env-note" id="ticketRequired-env" hidden></small></div>
          </div>
        </section>
      </fieldset>
      <div class="actions">
        <p id="status" role="status" aria-live="polite" aria-atomic="true" data-state="loading">正在加载配置…</p>
        <div class="action-buttons"><button id="reload" type="button" disabled data-i18n="reload">重新加载</button><button id="save" type="submit" disabled>保存配置</button></div>
      </div>
    </form>
    </div>
    <footer data-i18n="footer">修改仅在保存后写入配置文件。关闭页面不会退出终端中的本机配置服务。</footer>
  </main>
  <script>
    'use strict';
    const secret = ${token};
    const defaultTypes = ${JSON.stringify(DEFAULT_TYPES)};
    const templates = ${JSON.stringify(COMMIT_TEMPLATES).replace(/</g, '\\u003c')};
    const messages = ${JSON.stringify(WEB_I18N).replace(/</g, '\\u003c')};
    function readPreference(key) { try { return localStorage.getItem(key); } catch { return null; } }
    function rememberPreference(key, value) { try { localStorage.setItem(key, value); } catch {} }
    const savedLanguage = readPreference('gai.web.language');
    let uiLanguage = savedLanguage === 'zh' || savedLanguage === 'en'
      ? savedLanguage : ((navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en');
    function t(key, values) {
      return messages[key][uiLanguage === 'en' ? 1 : 0].replace(/\\{(\\w+)\\}/g, function (_, name) { return String(values && values[name] !== undefined ? values[name] : '{' + name + '}'); });
    }
    const typeChoices = document.getElementById('type-choices');
    const customType = document.getElementById('custom-type');
    const templateSelect = document.getElementById('pattern-template');
    const patternInput = document.getElementById('pattern');
    templates.concat([{id:'custom'}]).forEach(function (template) {
      const option = document.createElement('option');
      option.value = template.id;
      option.dataset.i18n = 'template_' + template.id;
      option.textContent = t(option.dataset.i18n);
      templateSelect.append(option);
    });
    const form = document.getElementById('settings-form');
    const allFields = document.getElementById('all-fields');
    const saveButton = document.getElementById('save');
    const reloadButton = document.getElementById('reload');
    const status = document.getElementById('status');
    const errorBox = document.getElementById('error');
    const tokenInput = document.getElementById('token');
    const toggleToken = document.getElementById('toggle-token');
    const fields = [
      ['token', 'GAI_TOKEN'], ['model', 'GAI_MODEL'], ['baseUrl', 'GAI_BASE_URL'],
      ['lang', 'GAI_LANG'], ['commitLang', 'GAI_COMMIT_LANG'],
      ['types', 'GAI_COMMIT_TYPES'], ['pattern', 'GAI_COMMIT_PATTERN'],
      ['scope', 'GAI_COMMIT_SCOPE'], ['scopes', 'GAI_COMMIT_SCOPES'],
      ['emoji', 'GAI_COMMIT_EMOJI'], ['body', 'GAI_COMMIT_BODY'],
      ['subjectMax', 'GAI_COMMIT_SUBJECT_MAX'], ['ticketPattern', 'GAI_COMMIT_TICKET'],
      ['ticketRequired', 'GAI_COMMIT_TICKET_REQUIRED']
    ];
    let loaded = false;
    let busy = false;
    let baseline = '';
    let dirty = false;
    let envKeys = [];
    let statusKey = 'loading';
    let errorState = null;

    function renderError() {
      if (!errorState) return;
      const error = errorState.error;
      const detail = error && error.uiKey ? t(error.uiKey, error.uiValues)
        : error instanceof Error ? error.message : t('unknownError');
      errorBox.textContent = t(errorState.key, { detail: detail });
    }

    function showStatus(key, state) {
      statusKey = key;
      status.textContent = t(key);
      status.dataset.state = state;
      saveButton.textContent = t(state === 'saving' ? 'savingButton' : 'save');
    }

    function showError(key, error) {
      errorState = { key: key, error: error };
      renderError();
      errorBox.hidden = false;
    }

    function clearError() {
      errorState = null;
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    function setBusy(value) {
      busy = value;
      allFields.disabled = value || !loaded;
      saveButton.disabled = value || !loaded || !dirty;
      reloadButton.disabled = value;
      form.setAttribute('aria-busy', String(value));
    }

    function selectedTypes() {
      return Array.from(typeChoices.querySelectorAll('input:checked'), function (input) { return input.value; });
    }

    function updateTypes() {
      const selected = selectedTypes();
      document.getElementById('types-summary').textContent = selected.length
        ? t('selectedTypes', { count: selected.length }) : t('noTypes');
      const first = typeChoices.querySelector('input');
      if (first) first.setCustomValidity(selected.length ? '' : t('selectTypeError'));
    }

    function addTypeChoice(type, checked) {
      const label = document.createElement('label');
      label.className = 'type-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'commit-type';
      input.value = type;
      input.checked = checked;
      const span = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = type;
      const small = document.createElement('small');
      small.dataset.i18n = Object.prototype.hasOwnProperty.call(messages, 'type_' + type) ? 'type_' + type : 'typeCustom';
      small.textContent = t(small.dataset.i18n);
      span.append(strong, small);
      label.append(input, span);
      typeChoices.append(label);
    }

    function renderTypes(types) {
      typeChoices.replaceChildren();
      Array.from(new Set(defaultTypes.concat(types))).forEach(function (type) { addTypeChoice(type, types.includes(type)); });
      customType.value = '';
      customType.setCustomValidity('');
      updateTypes();
    }

    function showTemplateDescription() {
      const template = templates.find(function (item) { return item.id === templateSelect.value; });
      document.getElementById('pattern-example').textContent = template ? template.example : t('templateCustomHelp');
      document.getElementById('pattern-warning').hidden = Boolean(template && template.id === 'conventional');
      document.getElementById('preview-unscoped').textContent = template ? template.withoutScope : '—';
      document.getElementById('preview-breaking').textContent = template ? template.breaking : '—';
    }

    function syncTemplate() {
      const template = templates.find(function (item) { return item.pattern === patternInput.value; });
      templateSelect.value = template ? template.id : 'custom';
      showTemplateDescription();
    }

    templateSelect.addEventListener('change', function () {
      const template = templates.find(function (item) { return item.id === templateSelect.value; });
      if (template) patternInput.value = template.pattern;
      showTemplateDescription();
      if (!template) patternInput.focus();
      onEdit();
    });
    patternInput.addEventListener('input', syncTemplate);
    document.getElementById('add-type').addEventListener('click', function () {
      const type = customType.value.trim();
      if (!/^[a-z]+$/.test(type)) {
        customType.setCustomValidity(t('customTypeError'));
        customType.reportValidity();
        return;
      }
      customType.setCustomValidity('');
      const existing = Array.from(typeChoices.querySelectorAll('input')).find(function (input) { return input.value === type; });
      if (existing) existing.checked = true;
      else addTypeChoice(type, true);
      customType.value = '';
      updateTypes();
      onEdit();
    });
    customType.addEventListener('input', function () { customType.setCustomValidity(''); });
    customType.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); document.getElementById('add-type').click(); }
    });
    typeChoices.addEventListener('change', updateTypes);

    function collectSettings() {
      function value(id) { return document.getElementById(id).value; }
      function checked(id) { return document.getElementById(id).checked; }
      return {
        lang: value('lang'),
        commitLang: value('commitLang'),
        token: value('token'),
        model: value('model'),
        baseUrl: value('baseUrl'),
        convention: {
          types: selectedTypes(),
          pattern: value('pattern'),
          scope: checked('scope'),
          scopes: value('scopes').split(',').map(function (entry) { return entry.trim(); }).filter(Boolean),
          emoji: checked('emoji'),
          body: checked('body'),
          subjectMax: Number(value('subjectMax')),
          ticketPattern: value('ticketPattern'),
          ticketRequired: checked('ticketRequired')
        }
      };
    }

    function formSnapshot() {
      return JSON.stringify(collectSettings());
    }

    function render(data) {
      const settings = data.settings;
      envKeys = data.envKeys;
      const overridden = new Set(envKeys);
      fields.forEach(function (entry) {
        const id = entry[0];
        const key = entry[1];
        const input = document.getElementById(id);
        const value = Object.prototype.hasOwnProperty.call(settings, id) ? settings[id] : settings.convention[id];
        if (id === 'types') renderTypes(value);
        else if (input.type === 'checkbox') input.checked = value;
        else input.value = Array.isArray(value) ? value.join(', ') : String(value);
        input.disabled = overridden.has(key);
        document.getElementById(id + '-env').hidden = !overridden.has(key);
      });
      templateSelect.disabled = overridden.has('GAI_COMMIT_PATTERN');
      syncTemplate();
      document.getElementById('config-path').textContent = data.configPath;
      translateEnvironment();
      tokenInput.type = 'password';
      toggleToken.textContent = t('show');
      toggleToken.setAttribute('aria-pressed', 'false');
      loaded = true;
      baseline = formSnapshot();
      dirty = false;
    }

    function uiError(key, values) {
      const error = new Error(t(key, values));
      error.uiKey = key;
      error.uiValues = values;
      return error;
    }

    async function requestSettings(method, settings) {
      const options = { method: method, headers: { 'X-Gai-Token': secret }, cache: 'no-store', credentials: 'same-origin' };
      if (method === 'POST') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(settings);
      }
      let response;
      try { response = await fetch('/api/settings', options); }
      catch { throw uiError('networkError'); }
      let data;
      try { data = await response.json(); }
      catch { throw uiError('invalidResponse', { status: response.status }); }
      if (!response.ok) throw data && typeof data.error === 'string' ? new Error(data.error) : uiError('failedRequest', { status: response.status });
      if (!data || !data.settings || !data.settings.convention || !Array.isArray(data.envKeys) || typeof data.configPath !== 'string') {
        throw uiError('incompleteResponse');
      }
      return data;
    }


    async function loadSettings() {
      if (busy) return;
      if (dirty && !window.confirm(t('reloadConfirm'))) return;
      clearError();
      showStatus('loading', 'loading');
      setBusy(true);
      try {
        render(await requestSettings('GET'));
        showStatus('loaded', 'ready');
      } catch (error) {
        showError('loadError', error);
        showStatus(loaded ? 'reloadFailed' : 'loadFailed', 'error');
      } finally { setBusy(false); }
    }

    function onEdit() {
      if (!loaded || busy) return;
      dirty = formSnapshot() !== baseline;
      saveButton.disabled = !dirty;
      clearError();
      showStatus(dirty ? 'dirty' : 'clean', dirty ? 'dirty' : 'ready');
    }

    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (busy || !loaded || !dirty || !form.reportValidity()) return;
      const settings = collectSettings();
      clearError();
      showStatus('saving', 'saving');
      setBusy(true);
      try {
        render(await requestSettings('POST', settings));
        showStatus('saved', 'success');
      } catch (error) {
        showError('saveError', error);
        showStatus('saveFailed', 'error');
      } finally {
        saveButton.textContent = t('save');
        setBusy(false);
      }
    });
    reloadButton.addEventListener('click', loadSettings);
    toggleToken.addEventListener('click', function () {
      const visible = tokenInput.type === 'password';
      tokenInput.type = visible ? 'text' : 'password';
      toggleToken.textContent = t(visible ? 'hide' : 'show');
      toggleToken.setAttribute('aria-pressed', String(visible));
    });
    window.addEventListener('beforeunload', function (event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
    function translateEnvironment() {
      fields.forEach(function (entry) {
        const note = document.getElementById(entry[0] + '-env');
        note.textContent = envKeys.includes(entry[1]) ? t('envNote', { key: entry[1] }) : '';
      });
      const summary = document.getElementById('env-summary');
      summary.hidden = envKeys.length === 0;
      summary.textContent = envKeys.length ? t('envSummary', { keys: envKeys.join(', ') }) : '';
    }

    function translatePage() {
      document.documentElement.lang = uiLanguage === 'zh' ? 'zh-CN' : 'en';
      document.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = t(node.dataset.i18n); });
      ['placeholder', 'aria-label'].forEach(function (attribute) {
        document.querySelectorAll('[data-i18n-' + attribute + ']').forEach(function (node) {
          node.setAttribute(attribute, t(node.getAttribute('data-i18n-' + attribute)));
        });
      });
      if (!loaded) document.getElementById('config-path').textContent = t('readingPath');
      if (typeChoices.children.length) updateTypes();
      if (customType.validity.customError) customType.setCustomValidity(t('customTypeError'));
      showTemplateDescription();
      translateEnvironment();
      showStatus(statusKey, status.dataset.state);
      renderError();
      toggleToken.textContent = t(tokenInput.type === 'password' ? 'show' : 'hide');
      scheduleDirectoryUpdate();
    }

    const themeSelect = document.getElementById('theme-preference');
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    themeSelect.value = document.documentElement.dataset.themePreference;
    function applyTheme() {
      document.documentElement.dataset.themePreference = themeSelect.value;
      document.documentElement.dataset.theme = themeSelect.value === 'system'
        ? (colorScheme.matches ? 'dark' : 'light') : themeSelect.value;
    }
    themeSelect.addEventListener('change', function () { applyTheme(); rememberPreference('gai.web.theme', themeSelect.value); });
    if (colorScheme.addEventListener) colorScheme.addEventListener('change', applyTheme);
    else colorScheme.addListener(applyTheme);
    const languageSelect = document.getElementById('page-language');
    languageSelect.value = uiLanguage;
    languageSelect.addEventListener('change', function () {
      uiLanguage = languageSelect.value;
      rememberPreference('gai.web.language', uiLanguage);
      translatePage();
    });

    const directoryLinks = Array.from(document.querySelectorAll('#page-directory a'));
    const directorySections = directoryLinks.map(function (link) { return document.getElementById(link.hash.slice(1)); });
    function markCurrentSection(id) {
      directoryLinks.forEach(function (link) {
        if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    function updateDirectory() {
      let current = directorySections[0];
      directorySections.forEach(function (section) { if (section.getBoundingClientRect().top <= 100) current = section; });
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = directorySections[directorySections.length - 1];
      markCurrentSection(current.id);
    }
    let directoryUpdatePending = false;
    function scheduleDirectoryUpdate() {
      if (directoryUpdatePending) return;
      directoryUpdatePending = true;
      requestAnimationFrame(function () { directoryUpdatePending = false; updateDirectory(); });
    }
    directoryLinks.forEach(function (link) { link.addEventListener('click', function () { markCurrentSection(link.hash.slice(1)); }); });
    window.addEventListener('scroll', scheduleDirectoryUpdate, { passive: true });
    window.addEventListener('resize', scheduleDirectoryUpdate);
    window.addEventListener('hashchange', scheduleDirectoryUpdate);
    translatePage();
    loadSettings();
  </script>
</body>
</html>`;
}
