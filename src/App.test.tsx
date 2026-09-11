import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("渲染标题，并通过 useQuery + fetch 展示服务器状态", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ service: "test", status: "healthy", version: "0" }),
      text: async () => "",
    });

    renderApp();

    expect(screen.getByRole("heading", { name: "AI-RPG Web" })).toBeInTheDocument();
    expect(await screen.findByText("test · healthy · v0")).toBeInTheDocument();
  });
});
