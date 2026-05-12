/**
 * Chart Rendering Tests
 */

import { describe, it, expect } from "vitest";
import {
  renderLineChart,
  renderCandlestickChart,
  renderSparkline,
  renderMarketTable,
} from "./chart.js";

describe("renderLineChart", () => {
  it("returns message for empty data", () => {
    const result = renderLineChart([]);
    expect(result).toBe("No data to display");
  });

  it("renders chart with price data", () => {
    const prices: [number, number][] = [
      [Date.now() - 86400000, 100],
      [Date.now() - 43200000, 110],
      [Date.now(), 105],
    ];

    const result = renderLineChart(prices, {
      width: 20,
      height: 5,
      title: "Test Chart",
    });

    expect(result).toContain("Test Chart");
    expect(result).toContain("●"); // Chart point character
    expect(result).toContain("Current:");
  });

  it("handles single data point", () => {
    const prices: [number, number][] = [[Date.now(), 100]];

    const result = renderLineChart(prices, { width: 10, height: 5 });
    expect(result).toContain("●");
  });

  it("shows price change percentage", () => {
    const prices: [number, number][] = [
      [Date.now() - 86400000, 100],
      [Date.now(), 110],
    ];

    const result = renderLineChart(prices);
    expect(result).toContain("Change:");
    expect(result).toContain("▲"); // Positive change
  });
});

describe("renderCandlestickChart", () => {
  it("returns message for empty data", () => {
    const result = renderCandlestickChart([]);
    expect(result).toBe("No data to display");
  });

  it("renders candlestick chart with OHLC data", () => {
    const ohlc = [
      { timestamp: Date.now() - 86400000, open: 100, high: 110, low: 95, close: 105 },
      { timestamp: Date.now(), open: 105, high: 115, low: 100, close: 102 },
    ];

    const result = renderCandlestickChart(ohlc, {
      width: 20,
      height: 5,
      title: "OHLC Chart",
    });

    expect(result).toContain("OHLC Chart");
    expect(result).toContain("█"); // Bullish candle
    expect(result).toContain("▓"); // Bearish candle
    expect(result).toContain("O:"); // OHLC labels
    expect(result).toContain("H:");
    expect(result).toContain("L:");
    expect(result).toContain("C:");
  });
});

describe("renderSparkline", () => {
  it("returns empty string for empty data", () => {
    const result = renderSparkline([]);
    expect(result).toBe("");
  });

  it("renders sparkline with price data", () => {
    const prices = [100, 110, 105, 120, 115];
    const result = renderSparkline(prices, 5);

    expect(result.length).toBe(5);
    // Should contain sparkline characters
    expect(result).toMatch(/[▁▂▃▄▅▆▇█]+/);
  });

  it("handles flat data", () => {
    const prices = [100, 100, 100, 100];
    const result = renderSparkline(prices, 4);

    expect(result.length).toBe(4);
  });
});

describe("renderMarketTable", () => {
  it("renders table with coin data", () => {
    const coins = [
      {
        rank: 1,
        symbol: "BTC",
        name: "Bitcoin",
        price: 50000,
        change24h: 2.5,
        marketCap: 1000000000000,
        volume24h: 50000000000,
      },
      {
        rank: 2,
        symbol: "ETH",
        name: "Ethereum",
        price: 3000,
        change24h: -1.5,
        marketCap: 400000000000,
        volume24h: 20000000000,
      },
    ];

    const result = renderMarketTable(coins);

    expect(result).toContain("BTC");
    expect(result).toContain("ETH");
    expect(result).toContain("Bitcoin");
    expect(result).toContain("Ethereum");
    expect(result).toContain("Rank");
    expect(result).toContain("Symbol");
    expect(result).toContain("Price");
  });

  it("handles missing optional fields", () => {
    const coins = [
      {
        symbol: "TEST",
        name: "Test Coin",
        price: 1.5,
      },
    ];

    const result = renderMarketTable(coins);
    expect(result).toContain("TEST");
    expect(result).toContain("Test Coin");
  });

  it("includes currency in output", () => {
    const coins = [{ symbol: "BTC", name: "Bitcoin", price: 50000 }];
    const result = renderMarketTable(coins, "EUR");
    expect(result).toContain("EUR");
  });
});
