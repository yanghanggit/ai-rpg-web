/**
 * 会话消息（叙事）的增量拉取：记住已收到的最大 `sequence_id` 作游标，用 `/since` 只拉新增，
 * 再 `mergeSessionMessages` 合并（重复 / 乱序都安全）。
 *
 * 无操作时靠 `refetchInterval` 兜底，任务终态由调用方 `invalidateQueries` 立即拉一次。
 * 游标在 queryKey 里，按资源失效用前缀 `["get", SESSION_MESSAGES_PATH]`。
 */
import { useEffect, useState } from "react";
import { $api } from "../../api/query";
import type { Schemas } from "../../api/types";
import { mergeSessionMessages } from "./mergeSessionMessages";
import { sessionKey } from "./sessionKey";

/** 会话消息端点路径：供前缀失效使用（游标在 key 里，无法用完整 key 匹配）。 */
export const SESSION_MESSAGES_PATH = "/api/session_messages/v1/{user_name}/{game_name}/since";

const DEFAULT_POLL_INTERVAL_MS = 3_000;

type SessionMessage = Schemas["SessionMessage"];

export function useSessionMessages(
  userName: string,
  gameName: string,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
) {
  // 累积消息连同「属于哪个会话」一起存：切会话时自动归零、重拉全量（渲染期派生，无需清空 effect）。
  // `hasLoaded` 不能拿 `isPending` 代替：合并发生在 effect 里，isPending 变 false 的那一帧 messages
  // 还是空的，调用方会把未读基线记错。
  const session = sessionKey(userName, gameName);
  const [accumulated, setAccumulated] = useState<{
    session: string;
    messages: SessionMessage[];
    hasLoaded: boolean;
  }>({
    session,
    messages: [],
    hasLoaded: false,
  });
  const isCurrentSession = accumulated.session === session;
  const messages = isCurrentSession ? accumulated.messages : [];
  const hasLoaded = isCurrentSession && accumulated.hasLoaded;

  const cursor = messages.at(-1)?.sequence_id ?? 0;

  const query = $api.useQuery(
    "get",
    SESSION_MESSAGES_PATH,
    {
      params: {
        path: { user_name: userName, game_name: gameName },
        query: { last_sequence_id: cursor },
      },
    },
    { refetchInterval: pollIntervalMs },
  );

  useEffect(() => {
    const incoming = query.data?.session_messages;
    if (incoming === undefined) {
      return;
    }
    setAccumulated((previous) => {
      const base = previous.session === session ? previous.messages : [];
      const merged = mergeSessionMessages(base, incoming);
      // 没有变化时复用旧对象，避免每轮轮询都重渲染
      if (merged === base && previous.session === session && previous.hasLoaded) {
        return previous;
      }
      return { session, messages: merged, hasLoaded: true };
    });
  }, [query.data, session]);

  return {
    /** 已累积的消息，按 sequence_id 升序、无重复。 */
    messages,
    /** 当前会话是否已经吸收过至少一次响应（包含空响应）。 */
    hasLoaded,
    /** 首屏尚未拿到任何数据。 */
    isPending: query.isPending,
    error: query.error,
  };
}
