/**
 * MSW request handlers for E2E tests.
 * Mocks the BFF API responses for isolated, fast, reliable CI tests.
 */

import { http, HttpResponse } from "msw";

const BFF_ORIGIN = "http://localhost:18080";

// Mock user session
const mockUser = {
  id: 123,
  username: "testplayer",
  phone_number: "+62812345678",
  currency: "IDR",
  status: "active",
  role: "player",
  merchant_id: 456,
  must_change_password: false,
};

export const authHandlers = [
  // POST /api/v1/auth/login
  http.post(`${BFF_ORIGIN}/api/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as {
      identifier: string;
      password: string;
      device_id: string;
    };

    // Valid credentials
    if (body.identifier === "testplayer" && body.password === "password123") {
      return HttpResponse.json(
        {
          user_id: mockUser.id,
          username: mockUser.username,
          phone_number: mockUser.phone_number,
          currency: mockUser.currency,
          status: mockUser.status,
          role: mockUser.role,
          merchant_id: mockUser.merchant_id,
          must_change_password: mockUser.must_change_password,
          token: "mock-jwt-token-xyz",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        },
        { status: 200 }
      );
    }

    // Invalid credentials
    return HttpResponse.json(
      { message: "INVALID_CREDENTIALS" },
      { status: 401 }
    );
  }),

  // POST /api/v1/auth/register
  http.post(`${BFF_ORIGIN}/api/v1/auth/register`, async ({ request }) => {
    const body = (await request.json()) as {
      username: string;
      password: string;
      phone_number: string;
    };

    // Check if username already exists
    if (body.username === "existinguser") {
      return HttpResponse.json(
        { message: "USERNAME_TAKEN" },
        { status: 409 }
      );
    }

    // Success
    return HttpResponse.json(
      {
        user_id: mockUser.id + 1,
        username: body.username,
        phone_number: body.phone_number,
        currency: mockUser.currency,
        status: "pending",
        role: mockUser.role,
        merchant_id: mockUser.merchant_id,
        must_change_password: false,
        token: "mock-jwt-token-new-user",
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
      { status: 201 }
    );
  }),

  // GET /api/v1/auth/me
  http.get(`${BFF_ORIGIN}/api/v1/auth/me`, () => {
    return HttpResponse.json(
      {
        user_id: mockUser.id,
        username: mockUser.username,
        phone_number: mockUser.phone_number,
        currency: mockUser.currency,
        status: mockUser.status,
        role: mockUser.role,
        merchant_id: mockUser.merchant_id,
        must_change_password: mockUser.must_change_password,
      },
      { status: 200 }
    );
  }),
];

export const gameHandlers = [
  // GET /api/v1/games
  http.get(`${BFF_ORIGIN}/api/v1/games`, () => {
    return HttpResponse.json(
      {
        data: [
          {
            id: 1,
            name: "Slot Game 1",
            category: "slots",
            provider: "Provider A",
            image: "https://placehold.co/200x200",
            min_bet: 100,
            max_bet: 10000,
          },
          {
            id: 2,
            name: "Slot Game 2",
            category: "slots",
            provider: "Provider B",
            image: "https://placehold.co/200x200",
            min_bet: 100,
            max_bet: 10000,
          },
        ],
        total: 2,
      },
      { status: 200 }
    );
  }),

  // GET /api/v1/games/:id
  http.get(`${BFF_ORIGIN}/api/v1/games/:id`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json(
      {
        id: parseInt(id as string),
        name: `Game ${id}`,
        category: "slots",
        provider: "Provider A",
        image: "https://placehold.co/200x200",
        min_bet: 100,
        max_bet: 10000,
      },
      { status: 200 }
    );
  }),
];

export const walletHandlers = [
  // GET /api/v1/wallets/balance
  http.get(`${BFF_ORIGIN}/api/v1/wallets/balance`, () => {
    return HttpResponse.json(
      {
        balance: 1000000,
        currency: "IDR",
        available_balance: 1000000,
        locked_balance: 0,
      },
      { status: 200 }
    );
  }),

  // POST /api/v1/wallets/deposit
  http.post(`${BFF_ORIGIN}/api/v1/wallets/deposit`, async ({ request }) => {
    const body = (await request.json()) as { amount: number; method: string };

    return HttpResponse.json(
      {
        transaction_id: `txn-${Date.now()}`,
        amount: body.amount,
        method: body.method,
        status: "pending",
        qr_code: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      },
      { status: 201 }
    );
  }),

  // POST /api/v1/wallets/withdraw
  http.post(`${BFF_ORIGIN}/api/v1/wallets/withdraw`, async ({ request }) => {
    const body = (await request.json()) as { amount: number; method: string };

    return HttpResponse.json(
      {
        transaction_id: `txn-${Date.now()}`,
        amount: body.amount,
        method: body.method,
        status: "pending",
      },
      { status: 201 }
    );
  }),

  // GET /api/v1/wallets/transactions
  http.get(`${BFF_ORIGIN}/api/v1/wallets/transactions`, () => {
    return HttpResponse.json(
      {
        data: [
          {
            id: 1,
            type: "deposit",
            amount: 100000,
            status: "completed",
            created_at: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: 2,
            type: "withdrawal",
            amount: 50000,
            status: "completed",
            created_at: new Date(Date.now() - 172800000).toISOString(),
          },
        ],
        total: 2,
      },
      { status: 200 }
    );
  }),
];

export const handlers = [...authHandlers, ...gameHandlers, ...walletHandlers];
