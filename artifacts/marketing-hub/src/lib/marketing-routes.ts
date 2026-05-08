const ALLOW_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/pricing\/?$/,
  /^\/welcome\/?$/,
  /^\/products(\/.*)?$/,
  /^\/gallery(\/.*)?$/,
  /^\/blog(\/.*)?$/,
];

const DENY_PATTERNS: RegExp[] = [
  /^\/login/,
  /^\/forgot-password/,
  /^\/reset-password/,
  /^\/report/,
  /^\/shared-report/,
  /^\/health\//,
  /^\/admin/,
];

export function isMarketingRoute(path: string): boolean {
  const clean = path.split("?")[0].split("#")[0] || "/";
  if (DENY_PATTERNS.some(re => re.test(clean))) return false;
  return ALLOW_PATTERNS.some(re => re.test(clean));
}
