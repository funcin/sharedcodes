/**
 * 品牌唯一源。显示层（首页、分享页页脚、管理页 Logo、名单通知邮件）都从这里取，
 * 不要在模板或文案里再写死品牌名与仓库地址。
 */
export const BRAND = 'Shared Codes';
/** Logo 文字拆成细体 + 粗体两段 */
export const BRAND_A = 'Shared';
export const BRAND_B = 'Codes';
export const GITHUB_URL = 'https://github.com/funcin/sharedcodes';
export const DEPLOY_URL = `https://deploy.workers.cloudflare.com/?url=${GITHUB_URL}`;
