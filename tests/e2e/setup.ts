/**
 * Playwright test setup with MSW.
 * Initializes MSW to intercept API calls during E2E tests.
 */

import { setupServer } from "msw/node";
import { handlers } from "./fixtures/msw-handlers";

export const server = setupServer(...handlers);

// Start server before all tests
export async function setupMswServer() {
  server.listen({ onUnhandledRequest: "bypass" });
}

// Clean up after tests
export async function teardownMswServer() {
  server.close();
}

// Reset handlers between tests
export async function resetMswHandlers() {
  server.resetHandlers();
}
