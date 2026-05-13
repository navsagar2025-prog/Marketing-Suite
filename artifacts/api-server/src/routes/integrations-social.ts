/**
 * Social media OAuth integration routes.
 *
 * publicSocialRouter  – callback routes registered BEFORE requireAuth
 * protectedSocialRouter – all other routes registered AFTER requireAuth
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, lte } from "drizzle-orm";
import { createHmac, randomBytes, createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { db, socialAccountsTable, socialPostsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

// ── Crypto ─────────────────────────────────────────────────────────────────────
const _rawSecret = process.env.SESSION_SECRET;
if (!_rawSecret) throw new Error("SESSION_SECRET environment variable is required");
const SESSION_SECRET: string = _rawSecret;

function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const keyBuf = Buffer.from(
    createHmac("sha256", SESSION_SECRET).update("social-token-v1").digest()
  );
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptToken(encrypted: string): string {
  const buf = Buffer.from(encrypted, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const keyBuf = Buffer.from(
    createHmac("sha256", SESSION_SECRET).update("social-token-v1").digest()
  );
  const decipher = createDecipheriv("aes-256-gcm", keyBuf, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

function signState(payload: object): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function verifyState(signed: string): Record<string, unknown> | null {
  const dotIdx = signed.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const b64 = signed.slice(0, dotIdx);
  const sig = signed.slice(dotIdx + 1);
  const expected = createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ── Platform config ────────────────────────────────────────────────────────────
type PlatformConfig = {
  authUrl: string;
  tokenUrl: string;
  scopes: string;
  clientId: string;
  clientSecret: string;
  pkce?: boolean;
};

const SUPPORTED_PLATFORMS = ["twitter", "linkedin", "facebook", "instagram", "youtube"];

function getPlatformConfig(platform: string): PlatformConfig | null {
  switch (platform) {
    case "twitter":
      return {
        authUrl: "https://twitter.com/i/oauth2/authorize",
        tokenUrl: "https://api.twitter.com/2/oauth2/token",
        scopes: "tweet.read tweet.write users.read offline.access",
        clientId: process.env.TWITTER_CLIENT_ID ?? "",
        clientSecret: process.env.TWITTER_CLIENT_SECRET ?? "",
        pkce: true,
      };
    case "linkedin":
      return {
        authUrl: "https://www.linkedin.com/oauth/v2/authorization",
        tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
        scopes: "r_liteprofile w_member_social",
        clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      };
    case "facebook":
      return {
        authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
        scopes: "pages_manage_posts,pages_read_engagement,pages_show_list",
        clientId: process.env.FACEBOOK_APP_ID ?? "",
        clientSecret: process.env.FACEBOOK_APP_SECRET ?? "",
      };
    case "instagram":
      return {
        authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
        scopes: "instagram_basic,instagram_content_publish,pages_read_engagement,pages_show_list",
        clientId: process.env.FACEBOOK_APP_ID ?? "",
        clientSecret: process.env.FACEBOOK_APP_SECRET ?? "",
      };
    case "youtube":
      return {
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes:
          "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      };
    default:
      return null;
  }
}

function getRedirectUri(platform: string): string {
  const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:8080";
  return `https://${domain}/api/integrations/social/${platform}/callback`;
}

function getFrontendBase(): string {
  const domain = process.env.REPLIT_DEV_DOMAIN ?? "localhost:3000";
  return `https://${domain}`;
}

// ── Publish helpers ────────────────────────────────────────────────────────────
async function publishToTwitter(accessToken: string, content: string): Promise<string> {
  const fetchRes = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: content }),
  });
  if (!fetchRes.ok) {
    const err = await fetchRes.json().catch(() => ({}));
    throw new Error(`Twitter: ${JSON.stringify(err)}`);
  }
  const data = (await fetchRes.json()) as { data: { id: string } };
  return data.data.id;
}

async function publishToLinkedIn(
  accessToken: string,
  platformUserId: string,
  content: string
): Promise<string> {
  const fetchRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${platformUserId}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!fetchRes.ok) {
    const err = await fetchRes.json().catch(() => ({}));
    throw new Error(`LinkedIn: ${JSON.stringify(err)}`);
  }
  const data = (await fetchRes.json()) as { id: string };
  return data.id;
}

async function publishToFacebook(
  accessToken: string,
  pageId: string,
  content: string,
  mediaUrl?: string | null
): Promise<string> {
  const body: Record<string, string> = { message: content, access_token: accessToken };
  if (mediaUrl) body.link = mediaUrl;
  const fetchRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!fetchRes.ok) {
    const err = await fetchRes.json().catch(() => ({}));
    throw new Error(`Facebook: ${JSON.stringify(err)}`);
  }
  const data = (await fetchRes.json()) as { id: string };
  return data.id;
}

async function publishToInstagram(
  accessToken: string,
  igUserId: string,
  content: string,
  mediaUrl?: string | null
): Promise<string> {
  if (!mediaUrl) {
    throw new Error("Instagram requires an image URL. Add a media URL to this post.");
  }
  const containerBody = {
    caption: content,
    image_url: mediaUrl,
    media_type: "IMAGE",
    access_token: accessToken,
  };
  const containerFetch = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(containerBody),
  });
  if (!containerFetch.ok) {
    const err = await containerFetch.json().catch(() => ({}));
    throw new Error(`Instagram container: ${JSON.stringify(err)}`);
  }
  const container = (await containerFetch.json()) as { id: string };

  const publishFetch = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
  });
  if (!publishFetch.ok) {
    const err = await publishFetch.json().catch(() => ({}));
    throw new Error(`Instagram publish: ${JSON.stringify(err)}`);
  }
  const pub = (await publishFetch.json()) as { id: string };
  return pub.id;
}

// ── Auto-publish scheduled posts (called by cron) ────────────────────────────
export async function publishScheduledSocialPosts(): Promise<{ published: number; failed: number }> {
  const now = new Date();
  const due = await db
    .select()
    .from(socialPostsTable)
    .where(and(eq(socialPostsTable.status, "scheduled"), lte(socialPostsTable.scheduledAt, now)));

  let published = 0;
  let failed = 0;

  for (const post of due) {
    const accounts = await db
      .select()
      .from(socialAccountsTable)
      .where(eq(socialAccountsTable.platform, post.platform))
      .limit(1);

    if (accounts.length === 0) {
      await db
        .update(socialPostsTable)
        .set({ publishError: `No ${post.platform} account connected.` })
        .where(eq(socialPostsTable.id, post.id));
      failed++;
      continue;
    }

    const account = accounts[0];
    try {
      const accessToken = decryptToken(account.accessToken);
      let platformPostId = "";

      if (post.platform === "twitter") {
        platformPostId = await publishToTwitter(accessToken, post.content);
      } else if (post.platform === "linkedin") {
        platformPostId = await publishToLinkedIn(
          accessToken,
          account.platformUserId ?? "",
          post.content
        );
      } else if (post.platform === "facebook") {
        if (!account.platformPageId) throw new Error("No Facebook Page connected. Reconnect your account.");
        platformPostId = await publishToFacebook(
          accessToken,
          account.platformPageId,
          post.content,
          post.mediaUrl
        );
      } else if (post.platform === "instagram") {
        platformPostId = await publishToInstagram(
          accessToken,
          account.platformUserId ?? "",
          post.content,
          post.mediaUrl
        );
      } else {
        await db
          .update(socialPostsTable)
          .set({ publishError: `Auto-publishing to ${post.platform} is not supported.` })
          .where(eq(socialPostsTable.id, post.id));
        failed++;
        continue;
      }

      await db
        .update(socialPostsTable)
        .set({ status: "published", publishedAt: new Date(), platformPostId, publishError: null })
        .where(eq(socialPostsTable.id, post.id));
      published++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await db
        .update(socialPostsTable)
        .set({ publishError: msg.slice(0, 500) })
        .where(eq(socialPostsTable.id, post.id));
      logger.error({ err, postId: post.id }, "Social post auto-publish failed");
      failed++;
    }
  }

  return { published, failed };
}

// ── Public router (OAuth callbacks — no auth required) ───────────────────────
export const publicSocialRouter = Router();

publicSocialRouter.get(
  "/integrations/social/:platform/callback",
  async (req: Request, res: Response): Promise<void> => {
    const { platform } = req.params;
    const { code, state, error } = req.query as Record<string, string>;
    const frontendBase = getFrontendBase();

    if (error || !code || !state) {
      res.redirect(
        `${frontendBase}/settings?tab=integrations&social_error=${encodeURIComponent(error ?? "access_denied")}`
      );
      return;
    }

    const payload = verifyState(state);
    if (!payload || payload.platform !== platform || typeof payload.userId !== "number") {
      res.redirect(`${frontendBase}/settings?tab=integrations&social_error=invalid_state`);
      return;
    }

    const userId = payload.userId as number;
    const config = getPlatformConfig(platform);
    if (!config || !config.clientId || !config.clientSecret) {
      res.redirect(`${frontendBase}/settings?tab=integrations&social_error=not_configured`);
      return;
    }

    try {
      const redirectUri = getRedirectUri(platform);
      const tokenParams: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
      };

      let tokenFetchRes: globalThis.Response;
      if (config.pkce && typeof payload.codeVerifier === "string") {
        tokenParams.code_verifier = payload.codeVerifier;
        tokenFetchRes = await fetch(config.tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams(tokenParams),
        });
      } else {
        tokenParams.client_secret = config.clientSecret;
        tokenFetchRes = await fetch(config.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(tokenParams),
        });
      }

      if (!tokenFetchRes.ok) {
        const errText = await tokenFetchRes.text();
        logger.error({ platform, errText }, "Social OAuth token exchange failed");
        res.redirect(`${frontendBase}/settings?tab=integrations&social_error=token_exchange_failed`);
        return;
      }

      const tokenData = (await tokenFetchRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
      };

      // Fetch platform identity
      let platformUserId = "";
      let platformUsername = "";
      let platformPageId: string | undefined;
      let platformPageName: string | undefined;
      let finalAccessToken = tokenData.access_token;

      if (platform === "twitter") {
        const meRes = await fetch("https://api.twitter.com/2/users/me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as { data: { id: string; username: string } };
          platformUserId = me.data.id;
          platformUsername = `@${me.data.username}`;
        }
      } else if (platform === "linkedin") {
        const meRes = await fetch("https://api.linkedin.com/v2/me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (meRes.ok) {
          const me = (await meRes.json()) as {
            id: string;
            localizedFirstName: string;
            localizedLastName: string;
          };
          platformUserId = me.id;
          platformUsername = `${me.localizedFirstName} ${me.localizedLastName}`;
        }
      } else if (platform === "facebook") {
        // Prefer page access token for posting
        const pagesRes = await fetch(
          `https://graph.facebook.com/v19.0/me/accounts?access_token=${tokenData.access_token}`
        );
        if (pagesRes.ok) {
          const pages = (await pagesRes.json()) as {
            data: Array<{ id: string; name: string; access_token: string }>;
          };
          if (pages.data.length > 0) {
            platformPageId = pages.data[0].id;
            platformPageName = pages.data[0].name;
            platformUsername = pages.data[0].name;
            finalAccessToken = pages.data[0].access_token;
          }
        }
        const meRes = await fetch(
          `https://graph.facebook.com/v19.0/me?access_token=${tokenData.access_token}`
        );
        if (meRes.ok) {
          const me = (await meRes.json()) as { id: string; name: string };
          platformUserId = me.id;
          if (!platformUsername) platformUsername = me.name;
        }
      } else if (platform === "instagram") {
        const meRes = await fetch(
          `https://graph.facebook.com/v19.0/me?fields=id,name,instagram_business_account&access_token=${tokenData.access_token}`
        );
        if (meRes.ok) {
          const me = (await meRes.json()) as {
            id: string;
            name: string;
            instagram_business_account?: { id: string };
          };
          platformUserId = me.instagram_business_account?.id ?? me.id;
          platformUsername = me.name;
        }
      } else if (platform === "youtube") {
        const chRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&access_token=${tokenData.access_token}`
        );
        if (chRes.ok) {
          const ch = (await chRes.json()) as {
            items: Array<{ id: string; snippet: { title: string } }>;
          };
          if (ch.items.length > 0) {
            platformUserId = ch.items[0].id;
            platformUsername = ch.items[0].snippet.title;
          }
        }
      }

      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined;

      // Upsert the account
      const existing = await db
        .select({ id: socialAccountsTable.id })
        .from(socialAccountsTable)
        .where(
          and(
            eq(socialAccountsTable.staffUserId, userId),
            eq(socialAccountsTable.platform, platform)
          )
        )
        .limit(1);

      const accountData = {
        staffUserId: userId,
        platform,
        platformUserId: platformUserId || null,
        platformUsername: platformUsername || null,
        platformPageId: platformPageId ?? null,
        platformPageName: platformPageName ?? null,
        accessToken: encryptToken(finalAccessToken),
        refreshToken: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
        tokenExpiry: expiresAt ?? null,
        scopes: tokenData.scope ?? config.scopes,
      };

      if (existing.length > 0) {
        await db
          .update(socialAccountsTable)
          .set(accountData)
          .where(eq(socialAccountsTable.id, existing[0].id));
      } else {
        await db.insert(socialAccountsTable).values(accountData);
      }

      res.redirect(`${frontendBase}/social?connected=${platform}`);
    } catch (err) {
      logger.error({ err, platform }, "Social OAuth callback error");
      res.redirect(`${frontendBase}/settings?tab=integrations&social_error=callback_failed`);
    }
  }
);

// ── Protected router (requires auth) ─────────────────────────────────────────
export const protectedSocialRouter = Router();

// GET /integrations/social/accounts – list all connected accounts for current user
protectedSocialRouter.get(
  "/integrations/social/accounts",
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const accounts = await db
      .select({
        id: socialAccountsTable.id,
        platform: socialAccountsTable.platform,
        platformUserId: socialAccountsTable.platformUserId,
        platformUsername: socialAccountsTable.platformUsername,
        platformPageId: socialAccountsTable.platformPageId,
        platformPageName: socialAccountsTable.platformPageName,
        scopes: socialAccountsTable.scopes,
        tokenExpiry: socialAccountsTable.tokenExpiry,
        createdAt: socialAccountsTable.createdAt,
      })
      .from(socialAccountsTable)
      .where(eq(socialAccountsTable.staffUserId, userId));
    res.json(accounts);
  }
);

// GET /integrations/social/status – list which platforms are credential-configured
protectedSocialRouter.get(
  "/integrations/social/status",
  async (_req: Request, res: Response): Promise<void> => {
    const status: Record<string, { configured: boolean; signupUrl: string; devDocsUrl: string }> = {
      twitter: {
        configured: !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
        signupUrl: "https://developer.twitter.com/en/portal/petition/essential/basic-info",
        devDocsUrl: "https://developer.twitter.com/en/docs/twitter-api/getting-started/getting-access-to-the-twitter-api",
      },
      linkedin: {
        configured: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
        signupUrl: "https://www.linkedin.com/developers/apps/new",
        devDocsUrl: "https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow",
      },
      facebook: {
        configured: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
        signupUrl: "https://developers.facebook.com/apps/create/",
        devDocsUrl: "https://developers.facebook.com/docs/facebook-login/guides/access-tokens",
      },
      instagram: {
        configured: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
        signupUrl: "https://developers.facebook.com/apps/create/",
        devDocsUrl: "https://developers.facebook.com/docs/instagram-api/getting-started",
      },
      youtube: {
        configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        signupUrl: "https://console.cloud.google.com/apis/credentials",
        devDocsUrl: "https://developers.google.com/youtube/v3/getting-started",
      },
    };
    res.json(status);
  }
);

// GET /integrations/social/:platform/connect – initiate OAuth
protectedSocialRouter.get(
  "/integrations/social/:platform/connect",
  async (req: Request, res: Response): Promise<void> => {
    const { platform } = req.params;
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      res.status(400).json({ error: "Unknown platform" });
      return;
    }
    const config = getPlatformConfig(platform);
    if (!config || !config.clientId || !config.clientSecret) {
      res.status(400).json({
        error: `${platform} OAuth credentials are not configured. Add the required environment variables.`,
      });
      return;
    }

    const redirectUri = getRedirectUri(platform);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scopes,
    });

    let codeVerifier: string | undefined;
    if (config.pkce) {
      codeVerifier = generateCodeVerifier();
      params.set("code_challenge", generateCodeChallenge(codeVerifier));
      params.set("code_challenge_method", "S256");
    }

    // YouTube needs offline access
    if (platform === "youtube") {
      params.set("access_type", "offline");
      params.set("prompt", "consent");
    }

    const statePayload: Record<string, unknown> = {
      userId: req.user!.id,
      platform,
      nonce: randomBytes(8).toString("hex"),
    };
    if (codeVerifier) statePayload.codeVerifier = codeVerifier;
    params.set("state", signState(statePayload));

    const fullUrl = `${config.authUrl}?${params.toString()}`;
    if (req.query.json === "1") {
      res.json({ url: fullUrl });
    } else {
      res.redirect(fullUrl);
    }
  }
);

// DELETE /integrations/social/:platform – disconnect account
protectedSocialRouter.delete(
  "/integrations/social/:platform",
  async (req: Request, res: Response): Promise<void> => {
    const { platform } = req.params;
    const userId = req.user!.id;
    await db
      .delete(socialAccountsTable)
      .where(
        and(
          eq(socialAccountsTable.staffUserId, userId),
          eq(socialAccountsTable.platform, platform)
        )
      );
    res.sendStatus(204);
  }
);

// POST /social-posts/:id/publish – manually publish a post
protectedSocialRouter.post(
  "/social-posts/:id/publish",
  async (req: Request, res: Response): Promise<void> => {
    const postId = parseInt(req.params.id, 10);
    if (isNaN(postId)) {
      res.status(400).json({ error: "Invalid post ID" });
      return;
    }

    const userId = req.user!.id;

    const [post] = await db
      .select()
      .from(socialPostsTable)
      .where(eq(socialPostsTable.id, postId))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const [account] = await db
      .select()
      .from(socialAccountsTable)
      .where(
        and(
          eq(socialAccountsTable.staffUserId, userId),
          eq(socialAccountsTable.platform, post.platform)
        )
      )
      .limit(1);

    if (!account) {
      res.status(400).json({
        error: `No ${post.platform} account connected. Go to Settings → Integrations to connect your account.`,
      });
      return;
    }

    if (post.platform === "youtube") {
      res.status(400).json({
        error:
          "YouTube video publishing requires manual upload. Your channel is connected for tracking purposes.",
      });
      return;
    }

    try {
      const accessToken = decryptToken(account.accessToken);
      let platformPostId = "";

      if (post.platform === "twitter") {
        platformPostId = await publishToTwitter(accessToken, post.content);
      } else if (post.platform === "linkedin") {
        if (!account.platformUserId) {
          throw new Error("LinkedIn user ID missing. Please reconnect your account.");
        }
        platformPostId = await publishToLinkedIn(accessToken, account.platformUserId, post.content);
      } else if (post.platform === "facebook") {
        if (!account.platformPageId) {
          throw new Error("No Facebook Page found. Reconnect your account to grant page access.");
        }
        platformPostId = await publishToFacebook(
          accessToken,
          account.platformPageId,
          post.content,
          post.mediaUrl
        );
      } else if (post.platform === "instagram") {
        if (!account.platformUserId) {
          throw new Error("Instagram user ID missing. Please reconnect your account.");
        }
        platformPostId = await publishToInstagram(
          accessToken,
          account.platformUserId,
          post.content,
          post.mediaUrl
        );
      } else {
        res.status(400).json({ error: `Publishing to ${post.platform} is not yet supported.` });
        return;
      }

      const [updated] = await db
        .update(socialPostsTable)
        .set({
          status: "published",
          publishedAt: new Date(),
          platformPostId,
          publishError: null,
        })
        .where(eq(socialPostsTable.id, postId))
        .returning();

      res.json({ success: true, platformPostId, post: updated });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await db
        .update(socialPostsTable)
        .set({ publishError: errMsg.slice(0, 500) })
        .where(eq(socialPostsTable.id, postId));
      res.status(500).json({ error: errMsg });
    }
  }
);

export default protectedSocialRouter;
