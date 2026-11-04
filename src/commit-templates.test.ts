import { describe, expect, test } from 'bun:test';
import { COMMIT_TEMPLATES } from './commit-templates';
import { compileMessagePattern, Convention } from './config';
import { validatePlan, withEmoji } from './plan';
import { buildPrompt } from './prompt';


for (const template of COMMIT_TEMPLATES) {
  describe(template.id, () => {
    const convention: Convention = {
      types: ['feat'], scopes: ['web'], pattern: template.pattern, scope: true,
      body: false, emoji: false, subjectMax: 100, ticketPattern: '', ticketRequired: false,
    };
    const plan = (message: string, spec = convention) => validatePlan({ commits: [{ message, files: ['web.ts'] }] }, ['web.ts'], spec);

    test('accepts scoped, unscoped and breaking commits with the correct capture groups', () => {
      for (const [message, scope, breaking] of [
        [template.example, 'web', undefined],
        [template.withoutScope, undefined, undefined],
        [template.breaking, 'web', '!'],
      ] as const) {
        const groups = compileMessagePattern(template.pattern).exec(message)?.groups;
        expect(groups?.type).toBe('feat');
        expect(groups?.scope).toBe(scope);
        expect(groups?.breaking).toBe(breaking);
        expect(plan(message)[0].message).toBe(message);
      }
    });

    test('enforces allowed types and scope restrictions', () => {
      expect(() => plan(template.example.replace('feat', 'fix'))).toThrow();
      expect(() => plan(template.example.replace('web', 'api'))).toThrow();
      expect(() => plan(template.example, { ...convention, scope: false })).toThrow();
      expect(plan(template.withoutScope, { ...convention, scope: false })[0].message).toBe(template.withoutScope);
    });

    test('inserts emoji in the description without changing the format or scope', () => {
      const decorated = withEmoji(template.example, { ...convention, emoji: true });
      const groups = compileMessagePattern(template.pattern).exec(decorated)?.groups;
      expect(groups?.description).toBe('✨ 添加配置页面');
      expect(groups?.type).toBe('feat');
      expect(groups?.scope).toBe('web');
    });

    test('produces a parseable JSON example for the model even when the regex contains escapes', () => {
      const prompt = buildPrompt({
        cwd: '/repo', repoRoot: '/repo', scopeLabel: '.', files: ['web.ts'],
        status: new Map([['web.ts', 'modified']]), trackedDiff: '', trackedDiffTruncated: false, untrackedPreview: '',
        convention: { ...convention, body: true }, commitLang: 'zh',
      });
      const example = prompt.split('JSON schema：\n')[1].split('\n')[0];
      const shape = JSON.parse(example);
      expect(shape.commits[0].files).toEqual(['path/from/repo/root']);
      if (template.id !== 'conventional') expect(shape.commits[0].message).toBe(template.pattern);
      else expect(shape.commits[0].message.split('\n\n')).toHaveLength(2);
    });
  });
}
