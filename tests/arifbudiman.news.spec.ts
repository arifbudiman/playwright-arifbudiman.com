import { test, expect } from '@playwright/test';

const url = 'https://arifbudiman.com/news';

test.describe('News', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url);
  });

  test('has title', async ({ page }) => {
    await expect(page).toHaveTitle('Hacker News Digest - Arif Budiman');
  });

  test('has articles', async ({ page }) => {
    await expect(page.locator('body > div > main > section > h1')).toHaveText('Hacker News');

    await expect(page.locator('body > div > main > section > div > article:nth-child(29)')).toBeVisible();

    for (const article of await page.locator('body > div > main > section > div > article').all()) {
      await expect(article.locator('a').first()).toBeAttached();
      await article
        .locator('a')
        .first()
        .getAttribute('href')
        .then((articleLink) => {
          expect(articleLink).toMatch(
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,8}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/
          );
        });
      //console.log(await article.locator('a').first().getAttribute('href'));

      await expect(article.locator('time')).toBeAttached();
      const articleDateTime = await article.locator('time').getAttribute('datetime');
      expect(articleDateTime).not.toBeNull();
      if (!articleDateTime) throw new Error('Missing datetime attribute on article time element');

      const dateTime = new Date(articleDateTime);
      expect(isNaN(dateTime.getTime())).toBeFalsy();
      expect(dateTime.toISOString()).toBe(articleDateTime);
      // console.log(articleDateTime + ' vs. ' + dateTime)
    }
  });
});
