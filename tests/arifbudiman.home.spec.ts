import { test, expect } from '@playwright/test';

test.describe('Home', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://arifbudiman.com/');
  });

  test('has title', async ({ page }) => {
    await expect(page).toHaveTitle('Arif Budiman');
  });

  test('has hero image', async ({ page }) => {
    const heroImage = page.getByRole('img', { name: 'Alaska' });
    await expect(heroImage).toHaveJSProperty('complete', true);
    await expect(heroImage).toBeAttached();
    await expect(heroImage).not.toHaveJSProperty('naturalWidth', 0);
    await expect(heroImage).toHaveAttribute('src');
    await expect(heroImage).toHaveAttribute('srcset');
  });

  test('has working links on hero', async ({ page }) => {
    const heroLinks = [
      { linkText: 'News', linkDestinationTitle: 'Hacker News Digest - Arif Budiman' },
      { linkText: 'Radio', linkDestinationTitle: 'Jakarta Radio Stations - Arif Budiman' },
      { linkText: 'TV', linkDestinationTitle: 'World TV Stations - Arif Budiman' },
    ];

    for (const link of heroLinks) {
      await page.locator('a[type="button"]').filter({ hasText: link.linkText }).click();
      await expect(page).toHaveTitle(link.linkDestinationTitle);
      await page.goto('https://arifbudiman.com/');
    }
  });

  test('has recent plays', async ({ page }) => {
    await expect(page.locator('body > div > main > section:nth-child(2) > h1')).toHaveText('Recent plays');
    await expect(page.locator('body > div > main > section:nth-child(2) > div > div:nth-child(4)')).toBeVisible();

    await expect(
      (await page.locator('body > div > main > section:nth-child(2) > div > div').all()).length
    ).toBeGreaterThan(0);

    for (const song of await page.locator('body > div > main > section:nth-child(2) > div > div').all()) {
      await expect(song.locator('div:nth-child(1) > a')).toBeAttached();
      await expect(song.locator('div:nth-child(1) > a > img')).toBeAttached();
      await expect(song.locator('div:nth-child(2) > p > a')).toBeAttached();
      console.log((await song.locator('div:nth-child(2) > p > a').innerText()).replaceAll(/[\r\n]/gi, ' - '));
    }
  });
});
