import { test, expect } from '@playwright/test';

const url = 'https://arifbudiman.com/radio';

test.describe('Radio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url);
  });

  test('has initial title', async ({ page }) => {
    await expect(page).toHaveTitle('Jakarta Radio Stations - Arif Budiman');
  });

  test('has list of stations', async ({ page }) => {
    await expect(page.locator('body > div > main > section > h2').getByText('Stations')).toBeAttached();
  });

  test('has no list of recently played', async ({ page }) => {
    await expect(page.locator('body > div > main > section > h2:has-text("Recently Played")')).not.toBeAttached();
  });

  test('play a station', async ({ page }) => {
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

    const localStorageLastStation = await page.localStorage.getItem('radio_recent_stations').then((data) => {
      if (data === null) {
        throw new Error('radio_recent_stations was not found in localStorage');
      }
      return JSON.parse(data)[0].name as string;
    });

    console.log(localStorageLastStation + ' vs. ' + recentStation);

    expect(recentStation).toEqual(localStorageLastStation);
  });
});
