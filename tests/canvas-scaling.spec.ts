import { test, expect } from '@playwright/test';

test.describe('AI Drawing Canvas Scaling', () => {
  test('canvas should be square and scale to viewport width', async ({ browser }) => {
    // Create mobile viewport context
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone size
    });
    const clientPage = await context.newPage();

    // Navigate to TV to create session
    const tvPage = await browser.newPage();
    await tvPage.goto('http://localhost:5173/tv');
    await tvPage.waitForLoadState('networkidle');
    await tvPage.waitForSelector('.qr-code', { timeout: 10000 });
    const sessionId = (await tvPage.locator('.session-code').textContent())?.trim();

    // Join as player
    await clientPage.goto(`http://localhost:5173/join/${sessionId}`);
    await clientPage.waitForLoadState('networkidle');
    await clientPage.evaluate(() => localStorage.removeItem('playerName'));
    await clientPage.locator('input[type="text"]').fill('TestPlayer');
    await clientPage.locator('button:has-text("Join")').click();
    await clientPage.waitForTimeout(1000);

    // Select and start AI Drawing game
    await clientPage.locator('.game-option:has-text("AI Drawing")').click();
    await clientPage.waitForTimeout(500);
    await clientPage.locator('button:has-text("Start AI Drawing")').click();
    await clientPage.waitForTimeout(2000);

    // Take screenshot
    await clientPage.screenshot({ path: '/tmp/ai-drawing-canvas.png', fullPage: true });
    console.log('📸 Screenshot saved to /tmp/ai-drawing-canvas.png');

    // Verify canvas is square
    const canvasWrapper = clientPage.locator('.bg-gradient-to-br.from-purple-500').first();
    const box = await canvasWrapper.boundingBox();

    expect(box).toBeTruthy();
    if (box) {
      const diff = Math.abs(box.width - box.height);
      console.log(`📐 Canvas dimensions: ${box.width}px × ${box.height}px (diff: ${diff}px)`);

      // Canvas should be square (allow small rounding differences)
      expect(diff).toBeLessThan(10);

      // Canvas should use most of viewport width (accounting for padding)
      const viewport = clientPage.viewportSize();
      const widthUsage = ((box.width - 16) / viewport!.width) * 100;
      console.log(`📊 Canvas uses ${widthUsage.toFixed(1)}% of viewport width`);

      // Should use at least 85% of viewport width (with padding)
      expect(widthUsage).toBeGreaterThan(85);
    }

    await tvPage.close();
    await context.close();
  });
});
