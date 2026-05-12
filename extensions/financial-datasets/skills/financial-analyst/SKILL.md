---
name: financial-analyst
description: "Access comprehensive financial data - stocks, crypto, SEC filings, financial statements, and news via Financial Datasets API. Use for market research, fundamental analysis, and financial insights."
homepage: https://financialdatasets.ai
metadata: {"clawdbot":{"emoji":"📊"}}
---

# Financial Analyst

Access comprehensive financial data using the Financial Datasets API tools. This skill provides real-time and historical data for US stocks, cryptocurrencies, SEC filings, financial statements, and market news.

## Requirements

Set the `FINANCIAL_DATASETS_API_KEY` environment variable with your API key from [financialdatasets.ai](https://financialdatasets.ai).

## Available Tools

### Stock Prices
- `get_stock_price_snapshot` - Real-time stock price
- `get_stock_prices` - Historical stock prices

### Crypto Prices
- `get_crypto_price_snapshot` - Real-time crypto price (BTC-USD, ETH-USD, etc.)
- `get_crypto_prices` - Historical crypto prices
- `get_available_crypto_tickers` - List available crypto tickers

### Company Information
- `get_company_facts` - Company details: market cap, employees, sector, etc.
- `get_financial_metrics_snapshot` - Current P/E, margins, ratios
- `get_financial_metrics` - Historical financial metrics

### Financial Statements
- `get_income_statement` - Revenue, expenses, net income
- `get_balance_sheet` - Assets, liabilities, equity
- `get_cash_flow_statement` - Cash flows from operations, investing, financing

### SEC Filings
- `get_sec_filings` - List 10-K, 10-Q, 8-K filings
- `get_filing_items` - Extract specific sections (Risk Factors, MD&A, etc.)
- `get_available_filing_items` - List extractable items

### News & Estimates
- `get_financial_news` - Recent news articles (filterable by ticker)
- `get_analyst_estimates` - Earnings per share forecasts

## Example Queries

**Get current Apple stock price:**
Use `get_stock_price_snapshot` with ticker "AAPL"

**Analyze Tesla's financials:**
1. `get_company_facts` for company overview
2. `get_financial_metrics_snapshot` for current valuation
3. `get_income_statement` for revenue trends

**Research Bitcoin price history:**
Use `get_crypto_prices` with:
- ticker: "BTC-USD"
- interval: "day"
- start_date/end_date for range

**Find SEC filings:**
Use `get_sec_filings` with ticker and optional form_type filter

**Extract Risk Factors from 10-K:**
1. `get_sec_filings` to find the filing
2. `get_filing_items` with item "1A" to extract Risk Factors

## Data Coverage

- 100% US public companies (30,000+ tickers)
- 30+ years of historical fundamentals
- Active and delisted stocks
- Crypto data from Coinbase, Kraken, Bitfinex

## Notes

- All tickers are case-insensitive (converted to uppercase)
- Dates use YYYY-MM-DD format
- Financial statement periods: annual, quarterly, or ttm (trailing twelve months)
- Price intervals: day, week, month, year
