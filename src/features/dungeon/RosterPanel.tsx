import { displayName } from "../../components/displayName";
import { usePartyRoster } from "./usePartyRoster";
import { useRosterAction } from "./useRosterAction";
import { useRosterCandidates } from "./useRosterCandidates";

/**
 * 副本的「队伍名单」面板。
 *
 * 名单是进入副本前的预选同伴（`PartyRosterComponent`，挂在玩家实体上），为空即独自冒险。
 * 分两栏：当前队伍（可移出）与可加入的同伴。候选口径是「持 `NPCComponent` 且不是玩家」——
 * 玩家的蓝图类型往往也是 NPC，所以候选查询带了 `none_of=PlayerComponent`。
 *
 * 为「以后 NPC 可能很多」留余地的方式是**布局**，不是输入控件：两栏列表都限高可滚动，
 * 人数再多也只在列表内部滚动，不撑长页面。这是游戏客户端的交互基调——
 * 能点就不要让用户打字（见 docs/conventions.md「交互基调」）。
 *
 * 增删都是同步接口，成功后失效 group 查询，两栏一起刷新。
 * 玩家名由页面传入——本组件不 import 其他 feature（`features/` 之间不互相依赖）。
 */
export default function RosterPanel({
  userName,
  gameName,
  playerActor,
}: {
  userName: string;
  gameName: string;
  /** 玩家角色原始名（用于在队伍里标出自己）；未解析出来时为 `null`。 */
  playerActor: string | null;
}) {
  const roster = usePartyRoster(userName, gameName);
  const candidates = useRosterCandidates(userName, gameName);
  const action = useRosterAction(userName, gameName);

  const members = roster.data ?? [];
  // 已在名单里的不再出现在「可加入」里
  const available = (candidates.data ?? []).filter((name) => !members.includes(name));

  return (
    <section className="roster" aria-labelledby="roster-heading">
      <div className="section-head">
        <h2 id="roster-heading">队伍名单</h2>
        <span className="muted">副本预选同伴 · 为空则独自冒险</span>
      </div>

      {action.error ? <p className="error">队伍操作失败：{action.error}</p> : null}

      <div className="roster-columns">
        <div className="roster-column">
          <h3>当前队伍（{members.length + (playerActor ? 1 : 0)} 人）</h3>
          {roster.isPending ? <p className="muted">加载中…</p> : null}
          {roster.isError ? (
            <p className="error">无法获取队伍名单：{String(roster.error)}</p>
          ) : null}
          {roster.isSuccess ? (
            <ul className="roster-list roster-list--scroll">
              {playerActor ? (
                <li>
                  <span className="mono">{displayName(playerActor)}</span>
                  <span className="badge">玩家</span>
                </li>
              ) : null}
              {members.map((name) => (
                <li key={name}>
                  <span className="mono">{displayName(name)}</span>
                  <button
                    type="button"
                    disabled={action.isPending}
                    onClick={() => action.remove(name)}
                  >
                    移出
                  </button>
                </li>
              ))}
              {members.length === 0 ? <li className="muted">（暂无同伴）</li> : null}
            </ul>
          ) : null}
        </div>

        <div className="roster-column">
          <h3>可加入的同伴（{available.length}）</h3>
          {candidates.isPending ? <p className="muted">加载中…</p> : null}
          {candidates.isError ? (
            <p className="error">无法获取候选角色：{String(candidates.error)}</p>
          ) : null}
          {candidates.isSuccess ? (
            available.length === 0 ? (
              <p className="muted">（暂无）</p>
            ) : (
              <ul className="roster-list roster-list--scroll">
                {available.map((name) => (
                  <li key={name}>
                    <span className="mono">{displayName(name)}</span>
                    <button
                      type="button"
                      disabled={action.isPending}
                      onClick={() => action.add(name)}
                    >
                      加入
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
