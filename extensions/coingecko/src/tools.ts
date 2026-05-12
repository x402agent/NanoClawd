/**
 * CoinGecko Agent Tools
 *
 * Tools for interacting with CoinGecko Pro API to fetch real-time market data.
 */

import { getCoinGeckoApi } from "./api.js";
import {
  renderLineChart,
  renderCandlestickChart,
  renderSparkline,
  renderMarketTable,
} from "./chart.js";
import type { CoinGeckoConfig, CoinMarketData } from "./types.js";

interface ToolDeps {
  config: CoinGeckoConfig;
  logger?: { debug: (msg: string) => void; error: (msg: string) => void };
}

/**
 * Create all CoinGecko tools
 */
export function createCoinGeckoTools(deps: ToolDeps) {
  const api = getCoinGeckoApi({ logger: deps.logger });

  return [
    // Price lookup tool
    {
      name: "crypto_price",
      label: "Crypto Price",
      description:
        "Get current cryptocurrency prices by coin ID (e.g., bitcoin, ethereum) or symbol (e.g., btc, eth). Returns price, market cap, 24h volume, and 24h change.",
      inputSchema: {
        type: "object",
        properties: {
          coins: {
            type: "string",
            description:
              "Comma-separated coin IDs (e.g., 'bitcoin,ethereum') or symbols (e.g., 'btc,eth')",
          },
          currency: {
            type: "string",
            description:
              "Target currency for prices (default: usd). Supports: usd, eur, gbp, jpy, btc, eth, etc.",
          },
        },
        required: ["coins"],
      },
      execute: async (params: { coins: string; currency?: string }) => {
        const currency = params.currency || deps.config.defaultCurrency;
        const coinIds = params.coins.toLowerCase().split(",").map((c) => c.trim());

        try {
          // First try as coin IDs
          const priceData = await api.getSimplePrice({
            ids: coinIds,
            vsCurrencies: [currency],
            includeMarketCap: true,
            include24hrVol: true,
            include24hrChange: true,
            includeLastUpdatedAt: true,
          });

          if (Object.keys(priceData).length === 0) {
            // Try searching by symbol
            const searchResults = await Promise.all(
              coinIds.map((symbol) => api.search(symbol))
            );

            const foundIds: string[] = [];
            for (let i = 0; i < searchResults.length; i++) {
              const result = searchResults[i];
              const matchingCoin = result.coins.find(
                (c) => c.symbol.toLowerCase() === coinIds[i].toLowerCase()
              );
              if (matchingCoin) {
                foundIds.push(matchingCoin.id);
              }
            }

            if (foundIds.length > 0) {
              const priceBySymbol = await api.getSimplePrice({
                ids: foundIds,
                vsCurrencies: [currency],
                includeMarketCap: true,
                include24hrVol: true,
                include24hrChange: true,
                includeLastUpdatedAt: true,
              });
              return formatPriceResponse(priceBySymbol, currency);
            }

            return {
              error: `No coins found matching: ${params.coins}`,
              hint: "Try using CoinGecko coin IDs (e.g., 'bitcoin', 'ethereum') or search with crypto_search tool",
            };
          }

          return formatPriceResponse(priceData, currency);
        } catch (error) {
          return { error: String(error) };
        }
      },
    },

    // Token price by contract address
    {
      name: "crypto_token_price",
      label: "Token Price by Contract",
      description:
        "Get token price by contract address on a specific blockchain. Useful for newer tokens not yet listed by name.",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            description:
              "Blockchain platform ID (e.g., 'ethereum', 'solana', 'binance-smart-chain', 'polygon-pos')",
          },
          addresses: {
            type: "string",
            description: "Comma-separated token contract addresses",
          },
          currency: {
            type: "string",
            description: "Target currency (default: usd)",
          },
        },
        required: ["platform", "addresses"],
      },
      execute: async (params: {
        platform: string;
        addresses: string;
        currency?: string;
      }) => {
        const currency = params.currency || deps.config.defaultCurrency;
        const addresses = params.addresses.split(",").map((a) => a.trim());

        try {
          const priceData = await api.getTokenPrice({
            platform: params.platform,
            contractAddresses: addresses,
            vsCurrencies: [currency],
            includeMarketCap: true,
            include24hrVol: true,
            include24hrChange: true,
            includeLastUpdatedAt: true,
          });

          return formatPriceResponse(priceData, currency);
        } catch (error) {
          return { error: String(error) };
        }
      },
    },

    // Market data tool
    {
      name: "crypto_markets",
      label: "Crypto Markets",
      description:
        "Get market data for top cryptocurrencies including price, market cap, volume, and 24h change. Includes ASCII chart visualization.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description:
              "Optional category filter (e.g., 'decentralized-finance-defi', 'smart-contract-platform', 'meme-token')",
          },
          order: {
            type: "string",
            description:
              "Sort order: market_cap_desc (default), market_cap_asc, volume_desc, volume_asc",
          },
          limit: {
            type: "number",
            description: "Number of coins to return (default: 10, max: 100)",
          },
          currency: {
            type: "string",
            description: "Target currency (default: usd)",
          },
        },
      },
      execute: async (params: {
        category?: string;
        order?: string;
        limit?: number;
        currency?: string;
      }) => {
        const currency = params.currency || deps.config.defaultCurrency;
        const limit = Math.min(params.limit || 10, 100);

        try {
          const markets = await api.getCoinsMarkets({
            vsCurrency: currency,
            category: params.category,
            order: (params.order as any) || "market_cap_desc",
            perPage: limit,
            page: 1,
            sparkline: true,
            priceChangePercentage: "24h,7d",
          });

          const tableData = markets.map((coin) => ({
            rank: coin.market_cap_rank,
            symbol: coin.symbol,
            name: coin.name,
            price: coin.current_price,
            change24h: coin.price_change_percentage_24h,
            marketCap: coin.market_cap,
            volume24h: coin.total_volume,
            sparkline: coin.sparkline_in_7d?.price,
          }));

          const table = renderMarketTable(tableData, currency);

          return {
            display: table,
            data: markets.map((m) => ({
              id: m.id,
              symbol: m.symbol,
              name: m.name,
              price: m.current_price,
              marketCap: m.market_cap,
              volume24h: m.total_volume,
              change24h: m.price_change_percentage_24h,
              rank: m.market_cap_rank,
            })),
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    },

    // Price chart tool
    {
      name: "crypto_chart",
      label: "Crypto Price Chart",
      description:
        "Get price chart for a cryptocurrency. Returns ASCII chart visualization of price history.",
      inputSchema: {
        type: "object",
        properties: {
          coin: {
            type: "string",
            description: "Coin ID (e.g., 'bitcoin', 'ethereum')",
          },
          days: {
            type: "number",
            description:
              "Number of days of history (1, 7, 14, 30, 90, 180, 365, or 'max'). Default: 7",
          },
          chartType: {
            type: "string",
            description: "Chart type: 'line' (default) or 'candle' for candlestick",
          },
          currency: {
            type: "string",
            description: "Target currency (default: usd)",
          },
        },
        required: ["coin"],
      },
      execute: async (params: {
        coin: string;
        days?: number;
        chartType?: string;
        currency?: string;
      }) => {
        const currency = params.currency || deps.config.defaultCurrency;
        const days = params.days || 7;
        const chartType = params.chartType || "line";

        try {
          // Get coin info for title
          const coinInfo = await api.search(params.coin);
          const matchedCoin = coinInfo.coins.find(
            (c) =>
              c.id === params.coin.toLowerCase() ||
              c.symbol.toLowerCase() === params.coin.toLowerCase()
          );
          const coinId = matchedCoin?.id || params.coin.toLowerCase();
          const coinName = matchedCoin?.name || params.coin;

          let chart: string;

          if (chartType === "candle") {
            const ohlcData = await api.getCoinOHLC({
              id: coinId,
              vsCurrency: currency,
              days: days as 1 | 7 | 14 | 30 | 90 | 180 | 365 | "max",
            });

            chart = renderCandlestickChart(ohlcData, {
              width: deps.config.chartWidth,
              height: deps.config.chartHeight,
              title: `${coinName} (${coinId.toUpperCase()}) - ${days} Day OHLC Chart`,
              symbol: currency.toUpperCase(),
            });
          } else {
            const chartData = await api.getCoinMarketChart({
              id: coinId,
              vsCurrency: currency,
              days,
            });

            chart = renderLineChart(chartData.prices, {
              width: deps.config.chartWidth,
              height: deps.config.chartHeight,
              title: `${coinName} (${coinId.toUpperCase()}) - ${days} Day Price Chart`,
              symbol: currency.toUpperCase(),
            });
          }

          return {
            chart,
            coin: coinId,
            days,
            currency: currency.toUpperCase(),
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    },

    // Trending coins tool
    {
      name: "crypto_trending",
      label: "Trending Crypto",
      description:
        "Get trending cryptocurrencies on CoinGecko in the last 24 hours based on search popularity.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        try {
          const trending = await api.getTrending();

          const coins = trending.coins.map((item) => ({
            rank: item.item.score + 1,
            name: item.item.name,
            symbol: item.item.symbol,
            marketCapRank: item.item.market_cap_rank,
            priceBtc: item.item.price_btc,
            priceUsd: item.item.data?.price,
            change24h: item.item.data?.price_change_percentage_24h?.usd,
            sparkline: item.item.data?.sparkline,
          }));

          const lines = ["🔥 Trending Cryptocurrencies (Last 24h)", ""];
          for (const coin of coins.slice(0, 7)) {
            const changeStr =
              coin.change24h !== undefined
                ? `${coin.change24h >= 0 ? "+" : ""}${coin.change24h.toFixed(2)}%`
                : "N/A";
            const priceStr = coin.priceUsd
              ? `$${formatPrice(coin.priceUsd)}`
              : `${coin.priceBtc.toFixed(8)} BTC`;
            lines.push(
              `${coin.rank}. ${coin.name} (${coin.symbol.toUpperCase()}) - ${priceStr} | 24h: ${changeStr}`
            );
          }

          return {
            display: lines.join("\n"),
            coins,
            nfts: trending.nfts.slice(0, 5),
            categories: trending.categories.slice(0, 5),
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    },

    // Coin details tool
    {
      name: "crypto_info",
      label: "Crypto Info",
      description:
        "Get detailed information about a cryptocurrency including description, links, market data, and developer activity.",
      inputSchema: {
        type: "object",
        properties: {
          coin: {
            type: "string",
            description: "Coin ID (e.g., 'bitcoin', 'ethereum')",
          },
          currency: {
            type: "string",
            description: "Target currency for prices (default: usd)",
          },
        },
        required: ["coin"],
      },
      execute: async (params: { coin: string; currency?: string }) => {
        const currency = params.currency || deps.config.defaultCurrency;

        try {
          const coin = await api.getCoinById(params.coin.toLowerCase(), {
            marketData: true,
            communityData: true,
            developerData: true,
          });

          const md = coin.market_data;
          const currentPrice = md.current_price[currency] || md.current_price.usd;

          return {
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            description: coin.description.en?.slice(0, 500) + "...",
            rank: coin.market_cap_rank,
            categories: coin.categories,
            links: {
              homepage: coin.links.homepage[0],
              twitter: coin.links.twitter_screen_name
                ? `https://twitter.com/${coin.links.twitter_screen_name}`
                : null,
              reddit: coin.links.subreddit_url,
              github: coin.links.repos_url.github[0],
            },
            marketData: {
              price: currentPrice,
              marketCap: md.market_cap[currency] || md.market_cap.usd,
              volume24h: md.total_volume[currency] || md.total_volume.usd,
              change24h: md.price_change_percentage_24h,
              change7d: md.price_change_percentage_7d,
              change30d: md.price_change_percentage_30d,
              ath: md.ath[currency] || md.ath.usd,
              athDate: md.ath_date[currency] || md.ath_date.usd,
              athChangePercent: md.ath_change_percentage[currency] || md.ath_change_percentage.usd,
              atl: md.atl[currency] || md.atl.usd,
              atlDate: md.atl_date[currency] || md.atl_date.usd,
              circulatingSupply: md.circulating_supply,
              totalSupply: md.total_supply,
              maxSupply: md.max_supply,
            },
            community: {
              twitterFollowers: coin.community_data.twitter_followers,
              redditSubscribers: coin.community_data.reddit_subscribers,
            },
            developer: {
              githubStars: coin.developer_data.stars,
              githubForks: coin.developer_data.forks,
              commits4Weeks: coin.developer_data.commit_count_4_weeks,
            },
            sentiment: {
              up: coin.sentiment_votes_up_percentage,
              down: coin.sentiment_votes_down_percentage,
            },
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    },

    // Search tool
    {
      name: "crypto_search",
      label: "Search Crypto",
      description:
        "Search for cryptocurrencies, NFTs, and categories by name or symbol.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query (name, symbol, or partial match)",
          },
        },
        required: ["query"],
      },
      execute: async (params: { query: string }) => {
        try {
          const results = await api.search(params.query);

          return {
            coins: results.coins.slice(0, 10).map((c) => ({
              id: c.id,
              name: c.name,
              symbol: c.symbol,
              rank: c.market_cap_rank,
            })),
            nfts: results.nfts.slice(0, 5).map((n) => ({
              id: n.id,
              name: n.name,
              symbol: n.symbol,
            })),
            categories: results.categories.slice(0, 5).map((c) => ({
              id: c.id,
              name: c.name,
            })),
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    },

    // Global market data
    {
      name: "crypto_global",
      label: "Global Crypto Market",
      description:
        "Get global cryptocurrency market statistics including total market cap, volume, and BTC/ETH dominance.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        try {
          const global = await api.getGlobal();
          const defi = await api.getGlobalDefi();

          const data = global.data;

          return {
            totalMarketCap: data.total_market_cap.usd,
            totalVolume24h: data.total_volume.usd,
            marketCapChange24h: data.market_cap_change_percentage_24h_usd,
            dominance: {
              btc: data.market_cap_percentage.btc,
              eth: data.market_cap_percentage.eth,
            },
            activeCryptocurrencies: data.active_cryptocurrencies,
            markets: data.markets,
            defi: {
              marketCap: defi.data.defi_market_cap,
              volume24h: defi.data.trading_volume_24h,
              dominance: defi.data.defi_dominance,
              topCoin: defi.data.top_coin_name,
            },
            updatedAt: new Date(data.updated_at * 1000).toISOString(),
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    },

    // Top gainers/losers (Analyst plan)
    {
      name: "crypto_gainers_losers",
      label: "Top Gainers & Losers",
      description:
        "Get top gaining and losing cryptocurrencies by price change percentage. Requires Analyst plan or higher.",
      inputSchema: {
        type: "object",
        properties: {
          duration: {
            type: "string",
            description:
              "Time duration: 1h, 24h (default), 7d, 14d, 30d, 60d, 1y",
          },
          currency: {
            type: "string",
            description: "Target currency (default: usd)",
          },
        },
      },
      execute: async (params: { duration?: string; currency?: string }) => {
        const currency = params.currency || deps.config.defaultCurrency;
        const duration = params.duration || "24h";

        try {
          const data = await api.getTopGainersLosers({
            vsCurrency: currency,
            duration: duration as any,
          });

          const formatCoin = (coin: CoinMarketData) => ({
            id: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            price: coin.current_price,
            change: coin.price_change_percentage_24h,
            marketCap: coin.market_cap,
          });

          return {
            duration,
            currency: currency.toUpperCase(),
            gainers: data.top_gainers.slice(0, 10).map(formatCoin),
            losers: data.top_losers.slice(0, 10).map(formatCoin),
          };
        } catch (error) {
          const errorStr = String(error);
          if (errorStr.includes("402") || errorStr.includes("403")) {
            return {
              error: "This feature requires CoinGecko Analyst plan or higher",
              hint: "Upgrade at https://www.coingecko.com/en/api/pricing",
            };
          }
          return { error: errorStr };
        }
      },
    },

    // API usage check
    {
      name: "crypto_api_usage",
      label: "CoinGecko API Usage",
      description: "Check your CoinGecko API key usage and remaining credits.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      execute: async () => {
        try {
          const usage = await api.getApiUsage();

          return {
            plan: usage.plan,
            rateLimit: `${usage.rate_limit_request_per_minute} requests/minute`,
            monthlyCredits: {
              total: usage.monthly_call_credit,
              used: usage.current_total_monthly_calls,
              remaining: usage.current_remaining_monthly_calls,
              percentUsed: (
                (usage.current_total_monthly_calls / usage.monthly_call_credit) *
                100
              ).toFixed(2),
            },
          };
        } catch (error) {
          return { error: String(error) };
        }
      },
    },
  ];
}

/**
 * Format price response for display
 */
function formatPriceResponse(
  data: Record<string, any>,
  currency: string
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [coinId, priceData] of Object.entries(data)) {
    const price = priceData[currency];
    const marketCap = priceData[`${currency}_market_cap`];
    const volume = priceData[`${currency}_24h_vol`];
    const change = priceData[`${currency}_24h_change`];
    const lastUpdated = priceData.last_updated_at;

    result[coinId] = {
      price,
      priceFormatted: `${formatPrice(price)} ${currency.toUpperCase()}`,
      marketCap,
      volume24h: volume,
      change24h: change,
      change24hFormatted: change !== undefined ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : undefined,
      lastUpdated: lastUpdated ? new Date(lastUpdated * 1000).toISOString() : undefined,
    };
  }

  return result;
}

/**
 * Format price with appropriate precision
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
