export const GOOGLE_REQUIRED_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

export const GOOGLE_SCOPES_STRING = GOOGLE_REQUIRED_SCOPES.join(" ");
