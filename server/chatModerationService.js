const MAX_MUTE_MINUTES = 7 * 24 * 60;

const createPrivateSystemEvent = (playerUid, text, createdAt) => ({
  type: "chat-system-message",
  channelId: "logs",
  recipientPlayerUid: playerUid,
  text,
  createdAt,
  visibility: "private",
});

export const createChatModerationService = ({ repository = null, moderatorAccountIds = [] } = {}) => {
  const moderators = new Set(moderatorAccountIds.map((accountId) => String(accountId).trim().toLocaleLowerCase()));

  const isModerator = (session) => moderators.has(String(session?.accountId ?? "").toLocaleLowerCase());
  const findOnlineTarget = (name, playersByUid, sessionsByPlayerUid) => {
    const normalizedName = String(name ?? "").trim().toLocaleLowerCase();
    for (const player of playersByUid.values()) {
      if (player.name.toLocaleLowerCase() === normalizedName) {
        return { player, session: sessionsByPlayerUid.get(player.uid) ?? null };
      }
    }
    return null;
  };

  const handleCommand = ({ session, player, text, playersByUid, sessionsByPlayerUid, now }) => {
    const [commandName = "", ...args] = text.slice(1).trim().split(/\s+/);
    const command = commandName.toLocaleLowerCase();
    if (command === "who") {
      const names = [...playersByUid.values()].map((onlinePlayer) => onlinePlayer.name).sort();
      return {
        success: true,
        events: [createPrivateSystemEvent(player.uid, `Online (${names.length}): ${names.join(", ")}`, now)],
      };
    }
    if (!["mute", "unmute", "announce"].includes(command)) {
      return { success: false, reason: "unknown-chat-command" };
    }
    if (!isModerator(session)) {
      return { success: false, reason: "chat-command-forbidden" };
    }
    if (command === "announce") {
      const announcement = args.join(" ").trim();
      return announcement
        ? {
            success: true,
            events: [{
              type: "chat-system-message",
              channelId: "global",
              text: announcement,
              createdAt: now,
              visibility: "global",
            }],
          }
        : { success: false, reason: "invalid-chat-command" };
    }

    const target = findOnlineTarget(args[0], playersByUid, sessionsByPlayerUid);
    if (!target?.session?.accountId) {
      return { success: false, reason: "chat-target-not-found" };
    }
    if (command === "unmute") {
      repository?.unmute(target.session.accountId);
      return {
        success: true,
        events: [createPrivateSystemEvent(player.uid, `${target.player.name} can speak again.`, now)],
      };
    }

    const durationMinutes = Number.parseInt(args[1], 10);
    if (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > MAX_MUTE_MINUTES) {
      return { success: false, reason: "invalid-mute-duration" };
    }
    const reason = args.slice(2).join(" ").trim() || "No reason provided";
    repository?.mute(
      target.session.accountId,
      now + durationMinutes * 60 * 1000,
      reason,
      session.accountId,
      now,
    );
    return {
      success: true,
      events: [
        createPrivateSystemEvent(player.uid, `${target.player.name} muted for ${durationMinutes} minute(s).`, now),
        createPrivateSystemEvent(target.player.uid, `You were muted: ${reason}`, now),
      ],
    };
  };

  return Object.freeze({
    handleMessage({ session, player, payload, playersByUid, sessionsByPlayerUid, now }) {
      if (payload.text.startsWith("/")) {
        return handleCommand({ session, player, text: payload.text, playersByUid, sessionsByPlayerUid, now });
      }
      const activeMute = repository?.getActiveMute(session.accountId, now) ?? null;
      if (activeMute) {
        return {
          success: false,
          reason: "chat-muted",
          changes: { mutedUntil: activeMute.mutedUntil },
        };
      }
      return null;
    },
  });
};
