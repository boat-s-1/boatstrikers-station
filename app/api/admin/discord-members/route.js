import { NextResponse } from "next/server";
import { isMembersAdminAuthenticated } from "../../../admin/members/_lib/membersAdminAuth";
import { discordApi, discordConfig, getAdminClient } from "../../../lib/discordPremium";
import { evaluateMemberEntitlement } from "../../../../lib/memberEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function listGuildMembers() {
  const { guildId } = discordConfig();
  const members = [];
  let after = "";

  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ limit: "1000" });
    if (after) query.set("after", after);
    const batch = await discordApi(`/guilds/${guildId}/members?${query.toString()}`);
    const rows = Array.isArray(batch) ? batch : [];
    members.push(...rows);
    if (rows.length < 1000) break;
    after = String(rows.at(-1)?.user?.id || "");
    if (!after) break;
  }

  return members.filter((member) => member?.user?.id && !member?.user?.bot);
}

export async function GET() {
  try {
    const authenticated = await isMembersAdminAuthenticated().catch(() => false);
    if (!authenticated) {
      return NextResponse.json({ error: "管理者ログインが必要です。" }, { status: 401 });
    }

    const admin = getAdminClient();
    const [{ data: links, error: linksError }, { data: profiles, error: profilesError }, guildMembers] = await Promise.all([
      admin.from("bs_member_discord_links")
        .select("user_id,discord_user_id,discord_username,discord_global_name,linked_at,last_role_synced_at,last_role_state")
        .limit(5000),
      admin.from("bs_member_profiles")
        .select("user_id,email,display_name,plan,membership_status,premium_until,beta_member,withdrawn_at")
        .limit(5000),
      listGuildMembers(),
    ]);

    if (linksError) throw linksError;
    if (profilesError) throw profilesError;

    const linkByDiscordId = new Map((links || []).map((row) => [String(row.discord_user_id), row]));
    const profileByUserId = new Map((profiles || []).map((row) => [String(row.user_id), row]));
    const { premiumRoleId } = discordConfig();

    const members = guildMembers.map((member) => {
      const discordUserId = String(member.user.id);
      const link = linkByDiscordId.get(discordUserId) || null;
      const profile = link ? profileByUserId.get(String(link.user_id)) || null : null;
      const entitlement = profile ? evaluateMemberEntitlement(profile) : null;
      const premiumEligible = Boolean(entitlement?.plus && !profile?.withdrawn_at);
      const premiumRoleAssigned = Array.isArray(member.roles) && member.roles.includes(premiumRoleId);
      const stage = !link ? "discord_only" : premiumEligible ? "premium" : "linked";

      return {
        discordUserId,
        username: member.user.username || "",
        globalName: member.user.global_name || "",
        nick: member.nick || "",
        joinedAt: member.joined_at || null,
        stage,
        linked: Boolean(link),
        premiumEligible,
        premiumRoleAssigned,
        userId: link?.user_id || null,
        email: profile?.email || "",
        displayName: profile?.display_name || "",
        plan: profile?.plan || null,
        linkedAt: link?.linked_at || null,
        lastRoleSyncedAt: link?.last_role_synced_at || null,
        lastRoleState: link?.last_role_state || null,
      };
    });

    const stats = members.reduce((acc, member) => {
      acc.total += 1;
      if (member.stage === "discord_only") acc.discordOnly += 1;
      if (member.stage === "linked") acc.linked += 1;
      if (member.stage === "premium") acc.premium += 1;
      if (member.linked) acc.siteLinked += 1;
      return acc;
    }, { total: 0, discordOnly: 0, linked: 0, premium: 0, siteLinked: 0 });

    return NextResponse.json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      stats: {
        ...stats,
        conversionRate: stats.total ? Math.round((stats.siteLinked / stats.total) * 1000) / 10 : 0,
      },
      members,
    });
  } catch (error) {
    console.error("admin discord members failed", error);
    const message = String(error?.message || error);
    const missingIntent = message.includes("403") || message.includes("Missing Access") || message.includes("Missing Permissions");
    return NextResponse.json({
      error: missingIntent
        ? "Discord参加者一覧を取得できませんでした。Discord Developer PortalのBot設定で Server Members Intent をONにしてください。"
        : "Discord参加者一覧を取得できませんでした。",
      detail: process.env.NODE_ENV === "development" ? message : undefined,
    }, { status: 502 });
  }
}
