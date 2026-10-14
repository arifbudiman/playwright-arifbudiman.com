import { test, expect } from '@playwright/test';

test.describe('Home', () => {
  test('has title', async ({ page }) => {
    await page.goto('https://arifbudiman.com/');
    await expect(page).toHaveTitle('Arif Budiman');
    page.close();
  });

  test('has hero image', async ({ page }) => {
    await page.goto('https://arifbudiman.com/');
    const heroImage = page.locator('body > div > main > section > img');
    await expect(heroImage).toBeAttached();
    await expect(heroImage).toHaveJSProperty('complete', true);
    await expect(heroImage).not.toHaveJSProperty('naturalWidth', 0);
    await expect(heroImage).toHaveAttribute('src');
    await expect(heroImage).toHaveAttribute('srcset');
    page.close();
  });

  test('has News link on hero', async ({ page }) => {
    await page.goto('https://arifbudiman.com/');
    await expect(page.locator('body > div > main > section > div > div > a:nth-child(1)')).toHaveText('News');
    await page.locator('body > div > main > section > div > div > a:nth-child(1)').click();
    await expect(page).toHaveTitle('Hacker News Digest - Arif Budiman');
    page.close();
  });

  test('has Radio link on hero', async ({ page }) => {
    await page.goto('https://arifbudiman.com/');
    await expect(page.locator('body > div > main > section > div > div > a:nth-child(2)')).toHaveText('Radio');
    await page.locator('body > div > main > section > div > div > a:nth-child(2)').click();
    await expect(page).toHaveTitle('Jakarta Radio Stations - Arif Budiman');
    page.close();
  });

  test('has TV link on hero', async ({ page }) => {
    await page.goto('https://arifbudiman.com/');
    await expect(page.locator('body > div > main > section > div > div > a:nth-child(3)')).toHaveText('TV');
    await page.locator('body > div > main > section > div > div > a:nth-child(3)').click();
    await expect(page).toHaveTitle('World TV Stations - Arif Budiman');
    page.close();
  });

  test('has recent plays', async ({ page }) => {
    await page.goto('https://arifbudiman.com/');

    await expect(page.locator('body > div > main > section:nth-child(2) > h1')).toHaveText('Recent plays');
    await expect(page.locator('body > div > main > section:nth-child(2) > div > div:nth-child(4)')).toBeVisible();

    for (const song of await page.locator('body > div > main > section:nth-child(2) > div > div').all()) {
      await expect(song.locator('div:nth-child(1) > a')).toBeAttached();
      await expect(song.locator('div:nth-child(1) > a > img')).toBeAttached();
      await expect(song.locator('div:nth-child(2) > p > a')).toBeAttached();
      //console.log(await song.locator('div:nth-child(2) > p > a').innerText())
    }

    page.close();
  });
});
