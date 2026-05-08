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

const TRACK_ALLOW_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/pricing\/?$/,
  /^\/welcome\/?$/,
  /^\/products(\/.*)?$/,
  /^\/gallery(\/.*)?$/,
  /^\/blog(\/.*)?$/,
  /^\/kb(\/.*)?$/,
  /^\/report\/?$/,
  /^\/report\/[^/]+\/?$/,
  /^\/shared-report\/[^/]+\/?$/,
  /^\/health\/[^/]+\/?$/,
];

export function isMarketingRoute(path: string): boolean {
  const clean = path.split("?")[0].split("#")[0] || "/";
  if (DENY_PATTERNS.some(re => re.test(clean))) return false;
  return ALLOW_PATTERNS.some(re => re.test(clean));
}

export function isTrackablePublicRoute(path: string): boolean {
  const clean = path.split("?")[0].split("#")[0] || "/";
  return TRACK_ALLOW_PATTERNS.some(re => re.test(clean));
}
