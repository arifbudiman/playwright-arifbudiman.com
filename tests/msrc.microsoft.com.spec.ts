import playwright from '@playwright/test';
import fs from 'fs';
import path from 'path';
import emailHeaderUtils from './utils/emailHeaderUtils.js';

const { parseRawEmail, extractSourceIP, extractDate, draftAbuseReport } = emailHeaderUtils;
const { test, expect } = playwright;
const rawMailFolder = 'D:\\Users\\arifb\\Downloads\\rawMails\\';
const url = 'https://msrc.microsoft.com/report/abuse?ThreatType=IpAddress&IncidentType=Spam';

test.describe('Report Spam', () => {
  try {
    const files = fs.readdirSync(rawMailFolder);
    const emlFiles = files.filter((file) => file.toLowerCase().endsWith('.eml'));

    emlFiles.forEach((file, index, array) => {
      const fullPath = path.join(rawMailFolder, file);

      if (fs.statSync(fullPath).isFile()) {
        const contentBuffer = fs.readFileSync(fullPath);
        const content = contentBuffer.toString('utf-8');
        const { headers } = parseRawEmail(content);
        const ip = extractSourceIP(headers);
        const date = extractDate(headers);

        test(`Submitted: ${file}`, async ({ page }) => {
          await page.goto(url);

          // Reporter name
          await page.locator('input[name=reporterName]').fill('Arif Budiman');

          // Reporter email
          await page.locator('input[name=reporterEmail]').fill('arifbudiman@gmail.com');

          // Incident date, time, and zone
          if (date && date.parsed) {
            // Construct incident date
            const year = date.parsed.getFullYear();
            const month = date.parsed.toLocaleString('default', { month: 'long' });
            const day = date.parsed.getDate();
            const dateLabel = day + ', ' + month + ', ' + year;

            // Select incident date
            const selectDate = page.getByText('Select a date...');
            const datePicker = page.getByRole('gridcell', { name: dateLabel });
            expect(async () => {
              await selectDate.blur();
              await selectDate.click();
              await expect(datePicker).toBeVisible({ timeout: 1000 });
            }).toPass();
            await datePicker.click();

            // await page.getByText('Select a date...').click();
            // await page.getByRole('gridcell', { name: dateLabel }).waitFor({ state: 'attached', timeout: 5000 });
            // await page.getByRole('gridcell', { name: dateLabel }).waitFor({ state: 'visible', timeout: 5000 });
            // await page.getByRole('gridcell', { name: dateLabel }).click();

            // const datePickerId = await page.getByText('Incident date').getAttribute('for');
            // const datePicker = page.locator('#' + datePickerId);
            // await datePicker.click().then(async () => {
            //   const calendarIcon = page.locator('i[data-icon-name=Calendar]');
            //   await calendarIcon.click().then(async () => {
            //     await page.waitForTimeout(1000);
            //     // Select incident date
            //     await page.getByLabel(dateLabel, { exact: true }).locator('..').click();
            //   });
            // });

            // Construct incident time
            const hours = date.parsed.getHours();
            const minutes = date.parsed.getMinutes();
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            // Fill out incident time
            await page.getByPlaceholder('HH:mm or HH:mm:ss').fill(formattedTime);

            // Construct timezone
            const offset = date.parsed.getTimezoneOffset();
            const absOffset = Math.abs(offset);
            const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
            const offsetMinutes = String(absOffset % 60).padStart(2, '0');
            // Notice the sign inversion: positive offset means we are behind UTC (-)
            const sign = offset <= 0 ? '+' : '-';
            // Select timezone
            await page.locator('#timeZoneDropdown-option').click();
            await page.locator('#timeZoneDropdown-list').waitFor({ state: 'visible' });
            await page.getByText(`(GMT${sign}${offsetHours}:${offsetMinutes})`).first().click();
          }

          // Source IP address
          if (ip) {
            // try {
            //   const rdap = await rdapLookup(ip);
            //   let abuseContact = await findAbuseContact(rdap);
            //   console.log(abuseContact);
            // } catch (error) {
            //   console.warn('RDAP lookup failed:', error);
            // }

            const label = await page.getByText('Source IP Address').getAttribute('for');
            await page.locator('#' + label).fill(ip);
          }

          // Report notes
          if (ip && date) {
            const reportNotes = draftAbuseReport({ ip, date });
            await page.locator('textarea[name="reportNotes"]').fill(reportNotes);
          }

          // Attach email file
          await page.locator('input[type="file"]').setInputFiles({
            name: file,
            mimeType: 'message/rfc822',
            buffer: contentBuffer,
          });

          await page.getByText('For more information on').scrollIntoViewIfNeeded();

          await page.waitForTimeout(1000);

          const maxRetries = 5;
          let attempt = 0;
          let isSuccessfullySubmitted = false;

          while (!isSuccessfullySubmitted && attempt < maxRetries) {
            attempt++;

            // Start waiting for response BEFORE clicking submit
            const responsePromise = page.waitForResponse(() => true);

            // Submit the form
            await page.getByRole('button', { name: 'Submit' }).click();

            const response = await responsePromise;

            if (response.status() === 429) {
              console.warn(`Hit 429 Too Many Requests on: ${response.url()}`);

              const data = await response.json();
              console.log(`Response.json: ${data.message}`);

              const match = data.message.match(/(\d+)\s+seconds/);
              const seconds = match ? parseInt(match[1], 10) : 20;

              console.log(`Waiting ${seconds + 2} seconds before retrying...`);
              await page.waitForTimeout((seconds + 2) * 1000);
            } else {
              expect(response.ok()).toBeTruthy();
              // https://msrc.microsoft.com/report/abuse/submitted
              await expect(page).toHaveURL(/.*submitted/, { timeout: 15000 });
              await expect(page).toHaveTitle('Report Submitted');
              await expect(page.getByRole('heading', { name: 'Thank you for submitting your' })).toBeVisible();
              isSuccessfullySubmitted = true;
              if (index < array.length - 1) {
                await page.waitForTimeout(1000);
              }
            }
          }
        });
      }
    });
  } catch (error) {
    console.error(`Error: ${error}`);
  }
});
