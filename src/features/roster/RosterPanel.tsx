import { displayName } from "../../components/displayName";
import { usePartyRoster } from "./usePartyRoster";
import { useRosterAction } from "./useRosterAction";
import { useRosterCandidates } from "./useRosterCandidates";

/**
 * 「队伍名单」面板（roster 领域的展示入口）：当前队伍在上、可加入的同伴在下，同一卡片栅格。
 *
 * 名单是 `PartyRosterComponent`；候选是「持 `NPCComponent` 且不是玩家」。卡片主体是名字按钮
 * （回调交给页面开角色信息浮窗），「加入 / 移出」是独立按钮。
 */
export default function RosterPanel({
  userName,
  gameName,
  playerActor,
  onSelectActor,
}: {
  userName: string;
  gameName: string;
  /** 玩家角色原始名（用于在队伍里标出自己）；未解析出来时为 `null`。 */
  playerActor: string | null;
  /** 点角色名时回调（页面据此打开角色信息浮窗）。 */
  onSelectActor: (actorName: string) => void;
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
      </div>

      {action.error ? <p className="error">队伍操作失败：{action.error}</p> : null}

      <div className="roster-sections">
        <div className="roster-section">
          <h3>当前队伍（{members.length + (playerActor ? 1 : 0)} 人）</h3>
          {roster.isPending ? <p className="muted">加载中…</p> : null}
          {roster.isError ? (
            <p className="error">无法获取队伍名单：{String(roster.error)}</p>
          ) : null}
          {roster.isSuccess ? (
            <>
              <ul className="roster-cards">
                {playerActor ? (
                  <li className="roster-card">
                    <button
                      type="button"
                      className="roster-card-name mono"
                      aria-label={`查看角色：${displayName(playerActor)}`}
                      onClick={() => onSelectActor(playerActor)}
                    >
                      {displayName(playerActor)}
                    </button>
                    <span className="badge">玩家</span>
                  </li>
                ) : null}
                {members.map((name) => (
                  <li className="roster-card" key={name}>
                    <button
                      type="button"
                      className="roster-card-name mono"
                      aria-label={`查看角色：${displayName(name)}`}
                      onClick={() => onSelectActor(name)}
                    >
                      {displayName(name)}
                    </button>
                    <button
                      type="button"
                      disabled={action.isPending}
                      onClick={() => action.remove(name)}
                    >
                      移出
                    </button>
                  </li>
                ))}
              </ul>
              {members.length === 0 ? <p className="muted">（暂无同伴）</p> : null}
            </>
          ) : null}
        </div>

        <div className="roster-section">
          <h3>可加入的同伴（{available.length}）</h3>
          {candidates.isPending ? <p className="muted">加载中…</p> : null}
          {candidates.isError ? (
            <p className="error">无法获取候选角色：{String(candidates.error)}</p>
          ) : null}
          {candidates.isSuccess ? (
            available.length === 0 ? (
              <p className="muted">（暂无）</p>
            ) : (
              <ul className="roster-cards">
                {available.map((name) => (
                  <li className="roster-card" key={name}>
                    <button
                      type="button"
                      className="roster-card-name mono"
                      aria-label={`查看角色：${displayName(name)}`}
                      onClick={() => onSelectActor(name)}
                    >
                      {displayName(name)}
                    </button>
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
