import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { client, unwrap } from "./api/client";
import { $api } from "./api/query";
import { toServerInfo } from "./api/server-info";

export default function App() {
  const [userName, setUserName] = useState("tester");
  const [gameName, setGameName] = useState("demo");

  // 类型安全的 useQuery：路径、响应全部自动推导。
  const info = $api.useQuery("get", "/");
  const serverInfo = info.data ? toServerInfo(info.data) : undefined;

  // 跨多个接口的编排流程（登录 → 新游戏），用原生 useMutation + client.POST。
  const start = useMutation({
    mutationFn: async () => {
      const body = { user_name: userName, game_name: gameName };
      unwrap(await client.POST("/api/login/v1/", { body }));
      return unwrap(await client.POST("/api/game/new/v1/", { body }));
    },
  });

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "2rem auto" }}>
      <h1>AI-RPG Web</h1>

      <section>
        <h2>服务器状态</h2>
        {info.isPending ? <p>连接中…</p> : null}
        {info.isError ? (
          <p style={{ color: "crimson" }}>无法连接后端：{String(info.error)}</p>
        ) : null}
        {info.isSuccess && serverInfo === undefined ? (
          <p style={{ color: "crimson" }}>后端响应格式不符合预期</p>
        ) : null}
        {serverInfo ? (
          <p>
            {serverInfo.service} · {serverInfo.status} · v{serverInfo.version}
          </p>
        ) : null}
      </section>

      <section>
        <h2>登录并开局</h2>
        <label>
          用户名 <input value={userName} onChange={(e) => setUserName(e.target.value)} />
        </label>{" "}
        <label>
          游戏名 <input value={gameName} onChange={(e) => setGameName(e.target.value)} />
        </label>{" "}
        <button type="button" onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? "处理中…" : "登录 → 新游戏"}
        </button>
        {start.isError ? <p style={{ color: "crimson" }}>出错：{String(start.error)}</p> : null}
        {start.isSuccess ? (
          <p style={{ color: "green" }}>开局成功 ✅ 蓝图：{start.data.blueprint.name}</p>
        ) : null}
      </section>
    </main>
  );
}
