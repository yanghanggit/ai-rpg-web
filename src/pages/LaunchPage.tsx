import { useNavigate } from "react-router";
import { API_BASE_URL } from "../api/client";
import { $api } from "../api/query";

/**
 * 启动屏（首页）。
 *
 * 职责边界：只确认「这个客户端能连上哪台服务器、服务器是否正常」，与玩家身份无关。
 * 因此这里没有登录/开局，玩家身份流程从 /lobby 开始。
 *
 * 后端根路由 `/` 已有 `response_model=ServerInfoResponse`，字段类型直接来自生成物，
 * 因此不再需要手写的收窄层（原先的 src/api/serverInfo.ts 已删除）。
 */
export default function LaunchPage() {
  const navigate = useNavigate();

  // 类型安全的 useQuery：路径、响应全部自动推导。
  const info = $api.useQuery("get", "/");
  const serverInfo = info.data;

  return (
    <main className="page">
      <h1>AI-RPG Web Dev</h1>
      <p className="muted">客户端启动屏 · 与服务器的连接检查</p>

      <dl className="facts">
        <dt>服务器地址</dt>
        <dd className="mono">{API_BASE_URL}</dd>

        <dt>连接状态</dt>
        <dd>
          {info.isPending ? (
            <span className="status">
              <span className="dot" />
              连接中…
            </span>
          ) : null}

          {info.isError ? (
            <span className="status error">
              <span className="dot error" />
              无法连接：{String(info.error)}
            </span>
          ) : null}

          {serverInfo ? (
            <span className="status ok">
              <span className="dot ok" />
              在线 · {serverInfo.service} · {serverInfo.status} · v{serverInfo.version}
            </span>
          ) : null}
        </dd>
      </dl>

      {info.isError ? (
        <p>
          <button type="button" onClick={() => void info.refetch()}>
            重试
          </button>
        </p>
      ) : null}

      <p>
        <button type="button" disabled={!info.isSuccess} onClick={() => navigate("/lobby")}>
          进入下一页 →
        </button>
      </p>
      {info.isSuccess ? null : <p className="muted">服务器可用后才能进入。</p>}
    </main>
  );
}
