import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
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
    expect(screen.getByRole("link", { name: /家园概览 HomeOverviewPage/ })).toBeInTheDocument();
  });
});
