import { test, expect } from '@playwright/test';

const url = 'https://arifbudiman.com/radio';

test.describe('Radio', () => {
  test('has initial title', async ({ page }) => {
    await page.goto(url);
    await expect(page).toHaveTitle('Jakarta Radio Stations - Arif Budiman');
    page.close();
  });

  test('has list of stations', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('body > div > main > section > h2').getByText('Stations')).toBeAttached();
    page.close();
  });

  test('has no list of recently played', async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('body > div > main > section > h2:has-text("Recently Played")')).not.toBeAttached();
    page.close();
  });

  test('play a station', async ({ page }) => {
    await page.goto(url);

    await page.localStorage.clear();

    await expect(page.locator('h2:has-text("Stations")')).toBeAttached();

    await page
      .locator('body > div > main > section > h2:has-text("Stations") + div > div > img:nth-child(19)')
      .click()
      .then(() => {
        expect(page.locator('body > div > main > section > div > h2:has-text("Recently Played")')).toBeAttached();
      });

    const recentStation = await page
      .locator('body > div > main > section > div > h2:has-text("Recently Played") + div img:nth-child(1)')
      .getAttribute('title');
    console.log(recentStation);

    const localStorageLastStation = await page.localStorage.getItem('radio_recent_stations').then((d) => {
      expect(d).not.toBeNull();
      return JSON.parse(d)[0].name;
    });
    console.log(localStorageLastStation);

    expect(recentStation).toEqual(localStorageLastStation);

    page.close();
  });
});
