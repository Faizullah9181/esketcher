import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Logo } from "@/components/common/Logo";

import { navigate, pathOf, routeOf, useRoute } from "./router";

afterEach(() => window.history.replaceState({}, "", "/"));

describe("router", () => {
  it("maps paths to routes", () => {
    expect(routeOf("/")).toBe("home");
    expect(routeOf("/studio")).toBe("studio");
    expect(routeOf("/studio/")).toBe("studio");
    expect(routeOf("/anything")).toBe("home");
    expect(pathOf("studio")).toBe("/studio");
  });

  it("navigates with history and follows back/forward", () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current).toBe("home");
    act(() => navigate("studio"));
    expect(result.current).toBe("studio");
    expect(window.location.pathname).toBe("/studio");
    const length = window.history.length;
    act(() => navigate("studio"));
    expect(window.history.length).toBe(length);
    act(() => {
      window.history.replaceState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current).toBe("home");
  });

  it("the logo always links home, leaving modifier clicks to the browser", () => {
    window.history.replaceState({}, "", "/studio");
    render(<Logo />);
    const link = screen.getByRole("link", { name: "eSketcher home" });
    expect(link).toHaveAttribute("href", "/");
    fireEvent.click(link, { metaKey: true });
    expect(window.location.pathname).toBe("/studio");
    fireEvent.click(link);
    expect(window.location.pathname).toBe("/");
  });
});
