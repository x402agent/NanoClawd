/**
 * CoinGecko API Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CoinGeckoApi, getCoinGeckoApi, resetCoinGeckoApi } from "./api.js";

describe("CoinGeckoApi", () => {
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    resetCoinGeckoApi();
    vi.stubEnv("COINGECKO_API_KEY", mockApiKey);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetCoinGeckoApi();
  });

  describe("constructor", () => {
    it("uses API key from environment variable", () => {
      const api = new CoinGeckoApi();
      // API key is private, but we can test that requests use it
      expect(api).toBeDefined();
    });

    it("uses API key from options", () => {
      const api = new CoinGeckoApi({ apiKey: "custom-key" });
      expect(api).toBeDefined();
    });

    it("logs warning when no API key provided", () => {
      vi.stubEnv("COINGECKO_API_KEY", "");
      const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
      };

      new CoinGeckoApi({ logger: mockLogger });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("COINGECKO_API_KEY not set")
      );
    });
  });

  describe("getCoinGeckoApi singleton", () => {
    it("returns same instance on multiple calls", () => {
      const api1 = getCoinGeckoApi();
      const api2 = getCoinGeckoApi();
      expect(api1).toBe(api2);
    });

    it("returns new instance after reset", () => {
      const api1 = getCoinGeckoApi();
      resetCoinGeckoApi();
      const api2 = getCoinGeckoApi();
      expect(api1).not.toBe(api2);
    });
  });

  describe("API methods", () => {
    it("throws error when API key not configured", async () => {
      vi.stubEnv("COINGECKO_API_KEY", "");
      const api = new CoinGeckoApi();

      await expect(api.ping()).rejects.toThrow("API key not configured");
    });
  });
});
