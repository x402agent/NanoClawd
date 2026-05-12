/**
 * Jupiter API Client
 * Provides integration with Jupiter Exchange limit orders and trading
 */

export interface CreateJupiterOrderRequest {
  maker: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
  expiredAt?: string;
}

export interface CreateJupiterOrderResponse {
  tx: string;
  orderKey: string;
}

export interface OpenJupiterOrderResponse {
  userPubkey: string;
  orderKey: string;
  inputMint: string;
  outputMint: string;
  makingAmount: string;
  takingAmount: string;
  remainingMakingAmount: string;
  remainingTakingAmount: string;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: string;
  openTx: string;
  closeTx: string;
  programVersion: string;
  trades: Array<{
    amount: string;
    price: string;
    timestamp: string;
  }>;
}

export interface CancelJupiterOrderRequest {
  maker: string;
  orders: string[];
}

export interface CancelJupiterOrderResponse {
  tx: string;
  canceled: string[];
}

export interface JupiterOrderHistoryResponse {
  orders: OpenJupiterOrderResponse[];
  hasMoreData: boolean;
  page: number;
}

const BASE_URL = 'https://api.jup.ag/limit/v2';

async function apiRequest<T>(method: 'GET' | 'POST', endpoint: string, data?: any, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (data && method === 'POST') {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url.toString(), options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json() as T;
  } catch (error: any) {
    throw new Error(`Jupiter API error: ${error.message || 'Unknown error'}`);
  }
}

export async function createOrderApi(
  data: CreateJupiterOrderRequest,
): Promise<CreateJupiterOrderResponse> {
  return apiRequest<CreateJupiterOrderResponse>('POST', '/createOrder', data);
}

export async function getOpenOrdersApi(
  walletAddress: string,
): Promise<OpenJupiterOrderResponse[]> {
  return apiRequest<OpenJupiterOrderResponse[]>('GET', '/openOrders', undefined, { wallet: walletAddress });
}

export async function cancelOrdersApi(
  data: CancelJupiterOrderRequest,
): Promise<CancelJupiterOrderResponse> {
  return apiRequest<CancelJupiterOrderResponse>('POST', '/cancelOrders', data);
}

export async function getOrderHistoryApi(
  walletAddress: string,
  page = 1,
): Promise<JupiterOrderHistoryResponse> {
  return apiRequest<JupiterOrderHistoryResponse>('GET', '/orderHistory', undefined, {
    wallet: walletAddress,
    page: page.toString(),
  });
}
