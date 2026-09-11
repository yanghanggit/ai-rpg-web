import { useState } from "react";
import { Link } from "react-router";
import { $api } from "../api/query";
import BlueprintDetails from "../features/entry/BlueprintDetails";
import { generatePlayerName } from "../features/entry/playerName";
import { useStartGame } from "../features/entry/useStartGame";

/**
 * 玩家入口页。
 *
 * - 玩家名：自动生成（带日期），当前不可编辑。
 * - 游戏名：从后端蓝图列表选择，不能手填——蓝图必须是服务器支持的。
 *
 * 这是占位形态：后续角色选择、读档等会替换掉这里的表单。
 */
export default function EntryPage() {
  const [playerName] = useState(generatePlayerName);

  // 游戏名候选来自后端，是唯一事实源，因此是选择型而非文本输入。
  const blueprints = $api.useQuery("get", "/api/game/blueprint-list/v1/");
  const list = blueprints.data?.blueprints ?? [];
  const [picked, setPicked] = useState("");
  const gameName = picked !== "" ? picked : (list[0]?.name ?? "");
  const current = list.find((blueprint) => blueprint.name === gameName);

  const start = useStartGame();
  const canSubmit = gameName !== "" && !start.isPending;

  return (
    <main className="page">
      <h1>玩家入口</h1>
      <p className="muted">
        <Link to="/">← 返回启动屏</Link>
      </p>

      <dl className="facts">
        <dt>玩家名</dt>
        <dd className="mono">
          {playerName} <span className="muted">（自动生成，暂不可改）</span>
        </dd>
      </dl>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) {
            start.mutate({ user_name: playerName, game_name: gameName });
          }
        }}
      >
        {blueprints.isPending ? <p className="muted">正在获取蓝图列表…</p> : null}
        {blueprints.isError ? (
          <p className="error">无法获取蓝图列表：{String(blueprints.error)}</p>
        ) : null}
        {blueprints.isSuccess && list.length === 0 ? (
          <p className="error">服务器没有可用蓝图。</p>
        ) : null}

        {list.length > 0 ? (
          <p>
            <label htmlFor="game-name">游戏名 </label>
            <select id="game-name" value={gameName} onChange={(e) => setPicked(e.target.value)}>
              {list.map((blueprint) => (
                <option key={blueprint.name} value={blueprint.name}>
                  {blueprint.name}
                </option>
              ))}
            </select>
          </p>
        ) : null}

        <p>
          <button type="submit" disabled={!canSubmit}>
            {start.isPending ? "处理中…" : "登录 → 新游戏"}
          </button>
        </p>
      </form>

      {start.isError ? <p className="error">出错：{String(start.error)}</p> : null}
      {start.isSuccess ? <p className="ok">开局成功 ✅ 蓝图：{start.data.blueprint.name}</p> : null}

      {current ? <BlueprintDetails blueprint={current} /> : null}
    </main>
  );
}
