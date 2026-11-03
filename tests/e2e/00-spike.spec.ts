import { test, expect } from '@playwright/test'

test('MSW REST + socket.io-client through MSW binding', async ({ page }) => {
  await page.clock.install()
  await page.goto('/some/deep/route')
  await expect(page.getByTestId('path')).toHaveText('/some/deep/route')
  await expect(page.getByTestId('health')).toContainText('"source":"msw"')
  await expect(page.getByTestId('socket')).toHaveText('connected')
  await expect(page.getByTestId('events')).toContainText('pong.app')

  // Server-initiated event triggered via an MSW REST handler.
  await page.getByRole('button', { name: 'trigger' }).click()
  await expect(page.getByTestId('events')).toContainText('nft.updated')

  // Server-initiated event triggered from the test via the mock control surface.
  await page.evaluate(() => window.__mock!.emit('nft.updated', { id: 'evt-2', version: 3 }))
  await expect(page.getByTestId('events')).toContainText('evt-2')

  // Events are filtered by the auth token sent in the socket.io CONNECT packet.
  await page.evaluate(() => window.__mock!.emit("nft.updated", { id: "evt-bob" }, "tok-bob"))
  await page.evaluate(() => window.__mock!.emit("nft.updated", { id: "evt-alice" }, "tok-alice"))
  await expect(page.getByTestId("events")).toContainText("evt-alice")
  await expect(page.getByTestId("events")).not.toContainText("evt-bob")

  // Heartbeat keeps the connection alive past pingInterval + pingTimeout.
  await page.clock.runFor(65_000)
  await expect(page.getByTestId('socket')).toHaveText('connected')

  // Server-side drop -> client reconnects automatically.
  await page.evaluate(() => window.__mock!.drop())
  await expect(page.getByTestId("socket")).toContainText("disconnected")
  await page.clock.runFor(10_000)
  await expect(page.getByTestId('socket')).toHaveText('connected')
})
