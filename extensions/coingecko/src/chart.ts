/**
 * ASCII Chart Rendering for Price Data
 *
 * Renders price history as ASCII line charts and candlestick charts.
 */

import type { OHLCData } from "./types.js";

export interface ChartOptions {
  width?: number;
  height?: number;
  showAxis?: boolean;
  showLabels?: boolean;
  title?: string;
  symbol?: string;
}

const defaultOptions: Required<ChartOptions> = {
  width: 60,
  height: 15,
  showAxis: true,
  showLabels: true,
  title: "",
  symbol: "USD",
};

/**
 * Format a price value with appropriate precision
 */
function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (price >= 1) {
    return price.toFixed(4);
  } else if (price >= 0.0001) {
    return price.toFixed(6);
  } else {
    return price.toExponential(4);
  }
}

/**
 * Format large numbers with suffixes (K, M, B, T)
 */
function formatCompact(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

/**
 * Render a simple line chart from price data points
 */
export function renderLineChart(
  prices: [number, number][], // [timestamp, price]
  options: ChartOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };

  if (prices.length === 0) {
    return "No data to display";
  }

  // Sample prices to fit width
  const sampledPrices = sampleData(
    prices.map((p) => p[1]),
    opts.width
  );

  const minPrice = Math.min(...sampledPrices);
  const maxPrice = Math.max(...sampledPrices);
  const priceRange = maxPrice - minPrice || 1;

  // Chart characters
  const chars = {
    empty: " ",
    point: "●",
    line: "─",
    up: "╱",
    down: "╲",
    corner: "•",
  };

  const lines: string[] = [];

  // Title
  if (opts.title) {
    lines.push(opts.title);
    lines.push("─".repeat(opts.width + (opts.showLabels ? 12 : 0)));
  }

  // Build chart grid
  const grid: string[][] = [];
  for (let row = 0; row < opts.height; row++) {
    grid.push(new Array(opts.width).fill(chars.empty));
  }

  // Plot points
  for (let col = 0; col < sampledPrices.length; col++) {
    const price = sampledPrices[col];
    const normalizedY = (price - minPrice) / priceRange;
    const row = Math.floor((1 - normalizedY) * (opts.height - 1));
    const clampedRow = Math.max(0, Math.min(opts.height - 1, row));

    // Draw connection to previous point
    if (col > 0) {
      const prevPrice = sampledPrices[col - 1];
      const prevNormalizedY = (prevPrice - minPrice) / priceRange;
      const prevRow = Math.floor((1 - prevNormalizedY) * (opts.height - 1));
      const prevClampedRow = Math.max(0, Math.min(opts.height - 1, prevRow));

      // Fill in vertical gaps
      const startRow = Math.min(clampedRow, prevClampedRow);
      const endRow = Math.max(clampedRow, prevClampedRow);
      for (let r = startRow; r <= endRow; r++) {
        if (r !== clampedRow) {
          grid[r][col] = "│";
        }
      }
    }

    grid[clampedRow][col] = chars.point;
  }

  // Render grid with axis labels
  const labelWidth = opts.showLabels ? 10 : 0;
  for (let row = 0; row < opts.height; row++) {
    let line = "";

    if (opts.showLabels) {
      // Y-axis labels (price)
      const priceAtRow = maxPrice - (row / (opts.height - 1)) * priceRange;
      if (row === 0 || row === opts.height - 1 || row === Math.floor(opts.height / 2)) {
        line += formatPrice(priceAtRow).padStart(labelWidth - 1) + " │";
      } else {
        line += " ".repeat(labelWidth - 1) + " │";
      }
    }

    line += grid[row].join("");
    lines.push(line);
  }

  // X-axis
  if (opts.showAxis) {
    const axisLine = opts.showLabels
      ? " ".repeat(labelWidth - 1) + " └" + "─".repeat(opts.width)
      : "└" + "─".repeat(opts.width);
    lines.push(axisLine);

    // Time labels
    if (prices.length >= 2) {
      const startDate = new Date(prices[0][0]);
      const endDate = new Date(prices[prices.length - 1][0]);
      const startLabel = formatDateShort(startDate);
      const endLabel = formatDateShort(endDate);
      const timeLine =
        " ".repeat(labelWidth) +
        startLabel +
        " ".repeat(Math.max(0, opts.width - startLabel.length - endLabel.length)) +
        endLabel;
      lines.push(timeLine);
    }
  }

  // Stats summary
  const startPrice = prices[0][1];
  const endPrice = prices[prices.length - 1][1];
  const changePercent = ((endPrice - startPrice) / startPrice) * 100;
  const changeSymbol = changePercent >= 0 ? "▲" : "▼";

  lines.push("");
  lines.push(
    `Current: ${formatPrice(endPrice)} ${opts.symbol} | ` +
      `Change: ${changeSymbol} ${Math.abs(changePercent).toFixed(2)}% | ` +
      `High: ${formatPrice(maxPrice)} | Low: ${formatPrice(minPrice)}`
  );

  return lines.join("\n");
}

/**
 * Render a candlestick chart from OHLC data
 */
export function renderCandlestickChart(
  ohlcData: OHLCData[],
  options: ChartOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };

  if (ohlcData.length === 0) {
    return "No data to display";
  }

  // Sample data to fit width (each candle takes 1 char)
  const sampledData = sampleOHLCData(ohlcData, opts.width);

  const allPrices = sampledData.flatMap((d) => [d.high, d.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;

  // Candlestick characters
  const chars = {
    bullBody: "█", // Green/up candle
    bearBody: "▓", // Red/down candle
    wick: "│",
    empty: " ",
  };

  const lines: string[] = [];

  // Title
  if (opts.title) {
    lines.push(opts.title);
    lines.push("─".repeat(opts.width + (opts.showLabels ? 12 : 0)));
  }

  // Build chart grid
  const grid: string[][] = [];
  for (let row = 0; row < opts.height; row++) {
    grid.push(new Array(opts.width).fill(chars.empty));
  }

  // Helper to convert price to row
  const priceToRow = (price: number): number => {
    const normalized = (price - minPrice) / priceRange;
    return Math.max(0, Math.min(opts.height - 1, Math.floor((1 - normalized) * (opts.height - 1))));
  };

  // Plot candles
  for (let col = 0; col < sampledData.length; col++) {
    const candle = sampledData[col];
    const isBull = candle.close >= candle.open;

    const highRow = priceToRow(candle.high);
    const lowRow = priceToRow(candle.low);
    const openRow = priceToRow(candle.open);
    const closeRow = priceToRow(candle.close);

    const bodyTop = Math.min(openRow, closeRow);
    const bodyBottom = Math.max(openRow, closeRow);

    // Draw wick (high to low)
    for (let row = highRow; row <= lowRow; row++) {
      if (row < bodyTop || row > bodyBottom) {
        grid[row][col] = chars.wick;
      }
    }

    // Draw body
    const bodyChar = isBull ? chars.bullBody : chars.bearBody;
    for (let row = bodyTop; row <= bodyBottom; row++) {
      grid[row][col] = bodyChar;
    }
  }

  // Render grid with axis labels
  const labelWidth = opts.showLabels ? 10 : 0;
  for (let row = 0; row < opts.height; row++) {
    let line = "";

    if (opts.showLabels) {
      const priceAtRow = maxPrice - (row / (opts.height - 1)) * priceRange;
      if (row === 0 || row === opts.height - 1 || row === Math.floor(opts.height / 2)) {
        line += formatPrice(priceAtRow).padStart(labelWidth - 1) + " │";
      } else {
        line += " ".repeat(labelWidth - 1) + " │";
      }
    }

    line += grid[row].join("");
    lines.push(line);
  }

  // X-axis
  if (opts.showAxis) {
    const axisLine = opts.showLabels
      ? " ".repeat(labelWidth - 1) + " └" + "─".repeat(opts.width)
      : "└" + "─".repeat(opts.width);
    lines.push(axisLine);

    // Time labels
    if (sampledData.length >= 2) {
      const startDate = new Date(sampledData[0].timestamp);
      const endDate = new Date(sampledData[sampledData.length - 1].timestamp);
      const startLabel = formatDateShort(startDate);
      const endLabel = formatDateShort(endDate);
      const timeLine =
        " ".repeat(labelWidth) +
        startLabel +
        " ".repeat(Math.max(0, opts.width - startLabel.length - endLabel.length)) +
        endLabel;
      lines.push(timeLine);
    }
  }

  // Legend and stats
  const latestCandle = sampledData[sampledData.length - 1];
  const firstCandle = sampledData[0];
  const changePercent =
    ((latestCandle.close - firstCandle.open) / firstCandle.open) * 100;
  const changeSymbol = changePercent >= 0 ? "▲" : "▼";

  lines.push("");
  lines.push(`█ = Bullish (close > open) | ▓ = Bearish (close < open)`);
  lines.push(
    `O: ${formatPrice(latestCandle.open)} | H: ${formatPrice(latestCandle.high)} | ` +
      `L: ${formatPrice(latestCandle.low)} | C: ${formatPrice(latestCandle.close)} | ` +
      `${changeSymbol} ${Math.abs(changePercent).toFixed(2)}%`
  );

  return lines.join("\n");
}

/**
 * Render a sparkline (mini chart) from price data
 */
export function renderSparkline(prices: number[], width = 20): string {
  if (prices.length === 0) return "";

  const sampled = sampleData(prices, width);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = max - min || 1;

  // Sparkline characters (8 levels)
  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

  return sampled
    .map((price) => {
      const normalized = (price - min) / range;
      const index = Math.min(
        chars.length - 1,
        Math.floor(normalized * chars.length)
      );
      return chars[index];
    })
    .join("");
}

/**
 * Render market data as a formatted table
 */
export function renderMarketTable(
  coins: Array<{
    rank?: number;
    symbol: string;
    name: string;
    price: number;
    change24h?: number;
    marketCap?: number;
    volume24h?: number;
    sparkline?: number[];
  }>,
  currency = "USD"
): string {
  const lines: string[] = [];

  // Header
  lines.push(
    "┌──────┬────────┬────────────────────┬───────────────┬──────────┬─────────────┬─────────────┬──────────────────────┐"
  );
  lines.push(
    "│ Rank │ Symbol │ Name               │ Price         │ 24h %    │ Market Cap  │ Volume 24h  │ 7d Trend             │"
  );
  lines.push(
    "├──────┼────────┼────────────────────┼───────────────┼──────────┼─────────────┼─────────────┼──────────────────────┤"
  );

  for (const coin of coins) {
    const rank = coin.rank?.toString().padStart(4) ?? "   -";
    const symbol = coin.symbol.toUpperCase().padEnd(6).slice(0, 6);
    const name = coin.name.padEnd(18).slice(0, 18);
    const price = formatPrice(coin.price).padStart(13);

    const change =
      coin.change24h !== undefined
        ? `${coin.change24h >= 0 ? "+" : ""}${coin.change24h.toFixed(2)}%`.padStart(8)
        : "      - ";

    const marketCap =
      coin.marketCap !== undefined
        ? formatCompact(coin.marketCap).padStart(11)
        : "          -";

    const volume =
      coin.volume24h !== undefined
        ? formatCompact(coin.volume24h).padStart(11)
        : "          -";

    const sparkline = coin.sparkline
      ? renderSparkline(coin.sparkline, 20)
      : " ".repeat(20);

    lines.push(
      `│ ${rank} │ ${symbol} │ ${name} │ ${price} │ ${change} │ ${marketCap} │ ${volume} │ ${sparkline} │`
    );
  }

  lines.push(
    "└──────┴────────┴────────────────────┴───────────────┴──────────┴─────────────┴─────────────┴──────────────────────┘"
  );
  lines.push(`Prices in ${currency.toUpperCase()}`);

  return lines.join("\n");
}

/**
 * Sample data points to fit a target width
 */
function sampleData(data: number[], targetWidth: number): number[] {
  if (data.length <= targetWidth) return data;

  const result: number[] = [];
  const step = data.length / targetWidth;

  for (let i = 0; i < targetWidth; i++) {
    const index = Math.floor(i * step);
    result.push(data[Math.min(index, data.length - 1)]);
  }

  return result;
}

/**
 * Sample OHLC data to fit a target width
 */
function sampleOHLCData(data: OHLCData[], targetWidth: number): OHLCData[] {
  if (data.length <= targetWidth) return data;

  const result: OHLCData[] = [];
  const step = data.length / targetWidth;

  for (let i = 0; i < targetWidth; i++) {
    const startIndex = Math.floor(i * step);
    const endIndex = Math.min(Math.floor((i + 1) * step), data.length);
    const segment = data.slice(startIndex, endIndex);

    if (segment.length === 0) continue;

    // Aggregate segment into single candle
    result.push({
      timestamp: segment[0].timestamp,
      open: segment[0].open,
      high: Math.max(...segment.map((s) => s.high)),
      low: Math.min(...segment.map((s) => s.low)),
      close: segment[segment.length - 1].close,
    });
  }

  return result;
}

/**
 * Format date for axis labels
 */
function formatDateShort(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");

  // If within 24 hours, show time; otherwise show date
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return `${hour}:${minute}`;
  }
  return `${month}/${day}`;
}
