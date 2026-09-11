/**
 * 会话消息（叙事）的增量拉取。
 *
 * 契约：`GET /api/session_messages/v1/{user_name}/{game_name}/since?last_sequence_id=N`
 * 返回 `sequence_id > N` 的消息。客户端记住已收到的最大 `sequence_id` 作为游标，
 * 每轮只拉新增部分，再用 `mergeSessionMessages` 合并——因此重复、乱序都不会出错。
 *
 * 本轮用轮询；将来换成 SSE（`/stream?last_sequence_id=N`，参数语义完全相同）时，
 * 本 hook 的对外接口不变，调用方无需改动。
 *
 * 注意：游标进了 queryKey（`[method, path, params]`），所以每前进一次会产生一个新的
 * 缓存条目（旧的由 gcTime 回收）。想按"整个会话消息资源"失效时，用
 * `["get", SESSION_MESSAGES_PATH]` 做前缀匹配。
 */
import { useEffect, useState } from "react";
import { $api } from "../../api/query";
import type { Schemas } from "../../api/types";
import { mergeSessionMessages } from "./mergeSessionMessages";

/** 会话消息端点路径：供前缀失效使用（游标在 key 里，无法用完整 key 匹配）。 */
export const SESSION_MESSAGES_PATH = "/api/session_messages/v1/{user_name}/{game_name}/since";

const DEFAULT_POLL_INTERVAL_MS = 3_000;

type SessionMessage = Schemas["SessionMessage"];

export function useSessionMessages(
  userName: string,
  gameName: string,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
) {
  // 累积的消息连同"属于哪个会话"一起存：切换会话时下面的 messages 自动回到空数组，
  // 于是游标归零、重新拉全量历史——不需要额外 effect 去清空（渲染期派生，React 推荐写法）。
  const session = `${userName}\u0000${gameName}`;
  const [accumulated, setAccumulated] = useState<{ session: string; messages: SessionMessage[] }>({
    session,
    messages: [],
  });
  const messages = accumulated.session === session ? accumulated.messages : [];

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
      return merged === base && previous.session === session
        ? previous
        : { session, messages: merged };
    });
  }, [query.data, session]);

  return {
    /** 已累积的消息，按 sequence_id 升序、无重复。 */
    messages,
    /** 首屏尚未拿到任何数据。 */
    isPending: query.isPending,
    error: query.error,
  };
}
