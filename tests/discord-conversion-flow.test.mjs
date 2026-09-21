import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const members = readFileSync("app/members/page.js", "utf8");
const discordPage = readFileSync("app/members/discord/page.js", "utf8");
const callback = readFileSync("app/api/members/discord/callback/route.js", "utf8");
const races = readFileSync("app/races/page.js", "utf8");
const alerts = readFileSync("app/races/components/AlertFlash.js", "utf8");
const cta = readFileSync("app/races/components/DiscordNotificationCta.js", "utf8");
const analytics = readFileSync("app/components/BoatAnalyticsTracker.js", "utf8");
const funnel = readFileSync("app/admin/members/Ga4FunnelPanel.js", "utf8");

test("Discord-oriented registration continues into notification setup", () => {
  assert.match(members, /nextStep === "discord"/);
  assert.match(members, /\/members\/discord\?from=signup/);
  assert.match(members, /emailRedirectTo/);
  assert.match(callback, /new URL\("\/members\/discord",origin\)/);
  assert.match(discordPage, /Discord連携が完了しました/);
});

test("AI and theory sections expose a state-aware Discord CTA", () => {
  assert.match(races, /source="ai_picks"/);
  assert.match(alerts, /source="theory_alerts"/);
  assert.match(cta, /getMemberAuthSnapshot/);
  assert.match(cta, /body\.linked/);
  assert.match(cta, /Discord通知設定を変更する/);
});

test("GA4 captures Discord acquisition and linking", () => {
  for (const event of [
    "discord_cta_click",
    "discord_signup_start",
    "discord_signup_complete",
    "discord_link_start",
    "discord_link_complete",
  ]) {
    assert.match(analytics + funnel, new RegExp(event));
  }
});
