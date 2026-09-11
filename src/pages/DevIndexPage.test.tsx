import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { api } from "../mocks/handlers";
import { server } from "../mocks/node";
import DevIndexPage from "./DevIndexPage";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DevIndexPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("开发索引页 /dev", () => {
  it("列出可点深链", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /家园 HomePage/ })).toBeInTheDocument();
  });

  it("触发后台任务后轮询到 completed（阶段 2 要复用的完整链路）", async () => {
    let polls = 0;
    server.use(
      http.post(api("/api/tasks/v1/trigger"), () =>
        HttpResponse.json({ job_id: "7", status: "running", message: "ok" }),
      ),
      http.get(api("/api/tasks/v1/status"), () => {
        polls += 1;
        return HttpResponse.json({
          tasks: [{ job_id: "7", status: polls < 2 ? "running" : "completed", error: null }],
        });
      }),
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "触发后台任务" }));

    // 触发后进入进行中：按钮禁用，job_id 显示出来
    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "任务进行中…" })).toBeDisabled();

    // 下一轮询到终态
    expect(await screen.findByText("completed", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "触发后台任务" })).toBeEnabled();
  });
});
