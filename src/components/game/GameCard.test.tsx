import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameCard } from "./GameCard";
import type { Game } from "@/types/api";

const game = (over: Partial<Game> = {}): Game => ({
  id: "ds-1001",
  vendor_id: "ds",
  game_code: "1001",
  name: "Lucky Fortune",
  category: "slot",
  min_bet: 0,
  max_bet: 0,
  status: "active",
  ...over,
});

describe("GameCard free play", () => {
  it("offers no demo button when the catalog does not flag the game", () => {
    render(<GameCard game={game()} onLaunch={vi.fn()} onLaunchDemo={vi.fn()} />);
    expect(screen.queryByText("Coba Gratis")).toBeNull();
    expect(screen.queryByText("Gratis")).toBeNull();
  });

  it("offers no demo button when the surface passes no demo handler", () => {
    render(<GameCard game={game({ demo_supported: true })} onLaunch={vi.fn()} />);
    expect(screen.queryByText("Coba Gratis")).toBeNull();
  });

  // The money-safety property of the default card: the demo pill must launch free play and
  // must NOT also trigger the tile's real-money launch underneath it.
  it("demo pill launches free play only, without bubbling to the real launch", () => {
    const onLaunch = vi.fn();
    const onLaunchDemo = vi.fn();
    render(
      <GameCard
        game={game({ demo_supported: true })}
        onLaunch={onLaunch}
        onLaunchDemo={onLaunchDemo}
      />
    );
    fireEvent.click(screen.getByText("Coba Gratis"));
    expect(onLaunchDemo).toHaveBeenCalledWith("ds-1001");
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("the tile itself still launches for real money by default", () => {
    const onLaunch = vi.fn();
    const onLaunchDemo = vi.fn();
    render(
      <GameCard
        game={game({ demo_supported: true })}
        onLaunch={onLaunch}
        onLaunchDemo={onLaunchDemo}
      />
    );
    fireEvent.click(screen.getByLabelText("Mainkan Lucky Fortune"));
    expect(onLaunch).toHaveBeenCalledWith("ds-1001");
    expect(onLaunchDemo).not.toHaveBeenCalled();
  });

  // The "Coba Gratis" shelf inverts the two. A tile in that row that quietly spent real money
  // would be the worst bug this feature could ship, so it is pinned here.
  describe("on the free-play shelf (demoFirst)", () => {
    it("the tile launches free play", () => {
      const onLaunch = vi.fn();
      const onLaunchDemo = vi.fn();
      render(
        <GameCard
          game={game({ demo_supported: true })}
          onLaunch={onLaunch}
          onLaunchDemo={onLaunchDemo}
          demoFirst
        />
      );
      fireEvent.click(screen.getByLabelText("Coba Lucky Fortune gratis"));
      expect(onLaunchDemo).toHaveBeenCalledWith("ds-1001");
      expect(onLaunch).not.toHaveBeenCalled();
    });

    it("real money moves to the explicit secondary button", () => {
      const onLaunch = vi.fn();
      const onLaunchDemo = vi.fn();
      render(
        <GameCard
          game={game({ demo_supported: true })}
          onLaunch={onLaunch}
          onLaunchDemo={onLaunchDemo}
          demoFirst
        />
      );
      fireEvent.click(screen.getByText("Mainkan dengan Saldo"));
      expect(onLaunch).toHaveBeenCalledWith("ds-1001");
      expect(onLaunchDemo).not.toHaveBeenCalled();
    });

    it("falls back to real money when the game is not demo-capable", () => {
      const onLaunch = vi.fn();
      const onLaunchDemo = vi.fn();
      render(<GameCard game={game()} onLaunch={onLaunch} onLaunchDemo={onLaunchDemo} demoFirst />);
      fireEvent.click(screen.getByLabelText("Mainkan Lucky Fortune"));
      expect(onLaunch).toHaveBeenCalledWith("ds-1001");
      expect(onLaunchDemo).not.toHaveBeenCalled();
    });
  });

  it("launches nothing at all while disabled", () => {
    const onLaunch = vi.fn();
    const onLaunchDemo = vi.fn();
    render(
      <GameCard
        game={game({ demo_supported: true })}
        onLaunch={onLaunch}
        onLaunchDemo={onLaunchDemo}
        disabled
      />
    );
    fireEvent.click(screen.getByLabelText("Mainkan Lucky Fortune"));
    fireEvent.click(screen.getByText("Coba Gratis"));
    expect(onLaunch).not.toHaveBeenCalled();
    expect(onLaunchDemo).not.toHaveBeenCalled();
  });
});
