import { DEFAULT_PATTERN } from './config';

/** Each template keeps the capture groups consumed by plan validation and emoji decoration. */
export const COMMIT_TEMPLATES = [
  {
    id: 'conventional', name: 'Conventional Commits（标准）', pattern: DEFAULT_PATTERN,
    example: 'feat(web): 添加配置页面', withoutScope: 'feat: 添加配置页面', breaking: 'feat(web)!: 调整配置接口',
  },
  {
    id: 'compact', name: '紧凑冒号',
    pattern: '^(?<type>[a-z]+)(?:\\((?<scope>[^)\\n]*)\\))?(?<breaking>!)?:(?<description>\\S.*)$',
    example: 'feat(web):添加配置页面', withoutScope: 'feat:添加配置页面', breaking: 'feat(web)!:调整配置接口',
  },
  {
    id: 'bracket', name: '方括号类型',
    pattern: '^\\[(?<type>[a-z]+)\\](?:\\((?<scope>[^)\\n]*)\\))?(?<breaking>!)? (?<description>.+)$',
    example: '[feat](web) 添加配置页面', withoutScope: '[feat] 添加配置页面', breaking: '[feat](web)! 调整配置接口',
  },
  {
    id: 'slash', name: '斜杠范围',
    pattern: '^(?<type>[a-z]+)(?:/(?<scope>[^!:\\s]+))?(?<breaking>!)?: (?<description>.+)$',
    example: 'feat/web: 添加配置页面', withoutScope: 'feat: 添加配置页面', breaking: 'feat/web!: 调整配置接口',
  },
  {
    id: 'dash', name: '短横线分隔',
    pattern: '^(?<type>[a-z]+)(?:\\((?<scope>[^)\\n]*)\\))?(?<breaking>!)? - (?<description>.+)$',
    example: 'feat(web) - 添加配置页面', withoutScope: 'feat - 添加配置页面', breaking: 'feat(web)! - 调整配置接口',
  },
];
