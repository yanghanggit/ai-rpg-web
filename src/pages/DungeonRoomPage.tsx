import { useNavigate, useParams } from "react-router";

/**
 * 副本房间页（**占位**）。
 *
 * 为什么单独一屏：发起「进入副本」成功后，玩家的场景已经变成副本第一关，
 * 副本总览页（生成 / 查阅 / 名单 / 进入）此刻全是**进入之前**的事，留在那里没有意义；
 * 而且副本进行中家园接口一律拒绝（`_validate_player_at_home`），玩家需要一个
 * 明确知道自己在副本里的落点。所以进入成功即切到这一屏。
 *
 * 目前只有骨架，接下来在这里展开（都需要后端已就绪的接口）：
 * - 当前房间：`GET /api/dungeons/v1/{user}/{game}/room`（判别字段 `room.type`，
 *   开场房间与战斗房间两种形态）；
 * - 推进关卡 `POST /api/dungeon/progress/advance_stage/v1/`、
 *   退出副本 `POST /api/dungeon/exit/v1/`（均为任务接口，走 `useTask` 那条线）。
 */
export default function DungeonRoomPage() {
  const { userName, gameName } = useParams();
  const navigate = useNavigate();

  // useParams 的类型是 string | undefined；路由已保证存在，这里做一次显式守卫
  if (!userName || !gameName) {
    return (
      <main className="page">
        <p className="error">URL 缺少会话参数，应为 /game/:userName/:gameName/dungeon/room</p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>副本进行中</h1>
      <p className="muted">房间界面（开场 / 战斗）尚未实现。</p>

      <div className="toolbar">
        <button type="button" onClick={() => navigate(`/game/${userName}/${gameName}/dungeon`)}>
          ← 返回副本总览
        </button>
      </div>
    </main>
  );
}
