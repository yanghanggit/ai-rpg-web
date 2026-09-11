import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiPost } from "./api/client";

interface ServerInfo {
  service: string;
  status: string;
  version: string;
}

interface LoginResponse {
  message: string;
}

interface NewGameResponse {
  [key: string]: unknown;
}

export default function App() {
  const [userName, setUserName] = useState("tester");
  const [gameName, setGameName] = useState("demo");

  const info = useQuery({
    queryKey: ["server-info"],
    queryFn: () => apiGet<ServerInfo>("/"),
    retry: false,
  });

  const start = useMutation({
    mutationFn: async () => {
      await apiPost<LoginResponse>("/api/login/v1/", {
        user_name: userName,
        game_name: gameName,
      });
      return apiPost<NewGameResponse>("/api/game/new/v1/", {
        user_name: userName,
        game_name: gameName,
      });
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
        {info.data ? (
          <p>
            {info.data.service} · {info.data.status} · v{info.data.version}
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
        {start.isSuccess ? <p style={{ color: "green" }}>开局成功 ✅</p> : null}
      </section>
    </main>
  );
}
