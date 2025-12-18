import { test, expect, Page } from '@playwright/test';
import { DevServer } from './setup';

let devServer: DevServer;

test.beforeAll(async () => {
  devServer = new DevServer();
  await devServer.start();
});

test.afterAll(async () => {
  await devServer.stop();
});

test.describe('Multi-client Game Flow', () => {
  test('should allow 2 clients to join and GM to start game', async ({ browser }) => {
    // Create separate contexts for TV and 2 phone clients
    const tvContext = await browser.newContext();
    const phone1Context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 390, height: 844 },
    });
    const phone2Context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 390, height: 844 },
    });

    const tvPage = await tvContext.newPage();
    const phone1Page = await phone1Context.newPage();
    const phone2Page = await phone2Context.newPage();

    try {
      // Step 1: TV creates a session
      console.log('Step 1: TV creating session...');
      await tvPage.goto('http://localhost:5173/tv');
      await tvPage.waitForLoadState('networkidle');

      // Wait for session to be created and QR code to appear
      await tvPage.waitForSelector('.qr-code', { timeout: 10000 });

      // Extract session ID from the page
      const sessionCodeElement = await tvPage.locator('.session-code').textContent();
      const sessionId = sessionCodeElement?.trim();
      expect(sessionId).toBeTruthy();
      expect(sessionId).toHaveLength(8);

      console.log(`Session created: ${sessionId}`);

      // Step 2: First player joins (becomes Game Master)
      console.log('Step 2: Player 1 joining as Game Master...');
      await phone1Page.goto(`http://localhost:5173/join/${sessionId}`);
      await phone1Page.waitForLoadState('networkidle');

      // Clear any stored name and enter new one
      await phone1Page.evaluate(() => localStorage.removeItem('playerName'));
      await phone1Page.reload();
      await phone1Page.waitForLoadState('networkidle');

      // Fill in name and join
      const nameInput1 = phone1Page.locator('input[type="text"]');
      await nameInput1.waitFor({ state: 'visible' });
      await nameInput1.fill('Alice');
      await phone1Page.locator('button:has-text("Join Game")').click();

      // Wait for join to complete - should see lobby with "Game Master" badge
      await phone1Page.waitForSelector('.gm-badge, .game-selection', { timeout: 10000 });
      console.log('Player 1 (Alice) joined as Game Master');

      // Verify player appears on TV
      await expect(tvPage.locator('text=Alice')).toBeVisible({ timeout: 5000 });
      console.log('Player 1 visible on TV');

      // Step 3: Second player joins
      console.log('Step 3: Player 2 joining...');
      await phone2Page.goto(`http://localhost:5173/join/${sessionId}`);
      await phone2Page.waitForLoadState('networkidle');

      // Clear any stored name and enter new one
      await phone2Page.evaluate(() => localStorage.removeItem('playerName'));
      await phone2Page.reload();
      await phone2Page.waitForLoadState('networkidle');

      const nameInput2 = phone2Page.locator('input[type="text"]');
      await nameInput2.waitFor({ state: 'visible' });
      await nameInput2.fill('Bob');
      await phone2Page.locator('button:has-text("Join Game")').click();

      // Wait for join to complete - should see waiting view or player list
      await phone2Page.waitForSelector('.waiting, .player-list', { timeout: 10000 });
      console.log('Player 2 (Bob) joined');

      // Verify both players appear on TV
      await expect(tvPage.locator('text=Alice')).toBeVisible();
      await expect(tvPage.locator('text=Bob')).toBeVisible();
      console.log('Both players visible on TV');

      // Step 4: Game Master selects a game
      console.log('Step 4: Game Master selecting game...');

      // Wait for game selection to be available
      const gameOption = phone1Page.locator('.game-option:has-text("Buzz Race")');
      await gameOption.waitFor({ state: 'visible', timeout: 10000 });
      await gameOption.click();

      console.log('Game selected: Buzz Race');

      // Wait a bit for state to sync
      await phone1Page.waitForTimeout(1000);

      // Step 5: Game Master starts the game
      console.log('Step 5: Game Master starting game...');
      const startButton = phone1Page.locator('button:has-text("Start Buzz Race")');
      await startButton.waitFor({ state: 'visible', timeout: 10000 });
      await startButton.click();

      console.log('Start button clicked');

      // Step 6: Verify game started on all clients
      console.log('Step 6: Verifying game started on all clients...');

      // TV should show the game (buzz race shows player scores and current player)
      await expect(tvPage.locator('.buzz-game-tv')).toBeVisible({ timeout: 10000 });
      console.log('Game visible on TV');

      // Phone 1 (GM) should see game controls
      await expect(phone1Page.locator('.buzz-client')).toBeVisible({ timeout: 10000 });
      await expect(phone1Page.locator('.buzz-button')).toBeVisible({ timeout: 10000 });
      console.log('Game controls visible on Phone 1');

      // Phone 2 should see game controls
      await expect(phone2Page.locator('.buzz-client')).toBeVisible({ timeout: 10000 });
      await expect(phone2Page.locator('.buzz-button')).toBeVisible({ timeout: 10000 });
      console.log('Game controls visible on Phone 2');

      console.log('✓ Test completed successfully! All clients connected and game started.');

    } finally {
      // Cleanup
      await tvPage.close();
      await phone1Page.close();
      await phone2Page.close();
      await tvContext.close();
      await phone1Context.close();
      await phone2Context.close();
    }
  });

  test('should auto-join with saved name', async ({ browser }) => {
    const tvContext = await browser.newContext();
    const phoneContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      viewport: { width: 390, height: 844 },
    });

    const tvPage = await tvContext.newPage();
    const phonePage = await phoneContext.newPage();

    try {
      // Create session on TV
      console.log('Creating session on TV...');
      await tvPage.goto('http://localhost:5173/tv');
      await tvPage.waitForSelector('.qr-code', { timeout: 10000 });

      const sessionId = (await tvPage.locator('.session-code').textContent())?.trim();
      console.log(`Session: ${sessionId}`);

      // First visit - join manually
      console.log('First visit: joining manually...');
      await phonePage.goto(`http://localhost:5173/join/${sessionId}`);
      await phonePage.waitForLoadState('networkidle');

      await phonePage.evaluate(() => localStorage.removeItem('playerName'));
      await phonePage.reload();
      await phonePage.waitForLoadState('networkidle');

      await phonePage.locator('input[type="text"]').fill('Charlie');
      await phonePage.locator('button:has-text("Join Game")').click();
      await phonePage.waitForSelector('.gm-badge, .game-selection', { timeout: 10000 });

      console.log('First join successful');

      // Verify name is stored
      const storedName = await phonePage.evaluate(() => localStorage.getItem('playerName'));
      expect(storedName).toBe('Charlie');
      console.log('Name stored in localStorage');

      // Leave and rejoin
      console.log('Leaving and rejoining with saved name...');
      await phonePage.goto('http://localhost:5173');

      // Create new session for second join
      await tvPage.goto('http://localhost:5173/tv');
      await tvPage.waitForSelector('.qr-code', { timeout: 10000 });
      const sessionId2 = (await tvPage.locator('.session-code').textContent())?.trim();

      // Visit join page - should auto-join
      await phonePage.goto(`http://localhost:5173/join/${sessionId2}`);

      // Should automatically join without showing the form
      await phonePage.waitForSelector('.gm-badge, .game-selection', { timeout: 10000 });

      // Verify on TV
      await expect(tvPage.locator('text=Charlie')).toBeVisible({ timeout: 5000 });

      console.log('✓ Auto-join test passed!');

    } finally {
      await tvPage.close();
      await phonePage.close();
      await tvContext.close();
      await phoneContext.close();
    }
  });
});
