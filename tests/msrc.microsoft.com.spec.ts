import playwright from '@playwright/test';
import fs from 'fs';
import path from 'path';
import emailHeaderUtils from './utils/emailHeaderUtils.js';

const { parseRawEmail, extractSourceIP, extractDate, draftAbuseReport } = emailHeaderUtils;
const { test } = playwright;
const rawMailFolder = 'D:\\Users\\arifb\\Downloads\\rawMails\\';
const url = 'https://msrc.microsoft.com/report/abuse?ThreatType=IpAddress&IncidentType=Spam';

test.describe('Report Spam', () => {
  try {
    const files = fs.readdirSync(rawMailFolder);

    files
      .filter((file) => file.toLowerCase().endsWith('.eml'))
      .forEach((file, index, array) => {
        const fullPath = path.join(rawMailFolder, file);

        if (fs.statSync(fullPath).isFile()) {
          const contentBuffer = fs.readFileSync(fullPath);
          const content = contentBuffer.toString('utf-8');
          const { headers } = parseRawEmail(content);
          const ip = extractSourceIP(headers);
          const date = extractDate(headers);

          test(`Submit report: ${file}`, async ({ page }) => {
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
              // Open date selector
              const datePickerId = await page.getByText('Incident date').getAttribute('for');
              const datePicker = page.locator('#' + datePickerId);
              await datePicker.click();
              const calendarIcon = page.locator('i[data-icon-name=Calendar]');
              await calendarIcon.click();
              await page.waitForTimeout(1000);

              // Select incident date
              await page.getByLabel(dateLabel, { exact: true }).locator('..').click();

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
              // Open timezone selector
              await page.locator('#timeZoneDropdown-option').click();
              // Select timezone
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

            // await page.locator('input[name=fileUpload]').setInputFiles(fullPath);
            // const fileChooserPromise = page.waitForEvent('filechooser');
            // await page.getByText('Choose a file to upload').click();
            // const fileChooser = await fileChooserPromise;
            // await fileChooser.setFiles(fullPath);

            // Attach email file
            await page.locator('input[type="file"]').setInputFiles({
              name: file,
              mimeType: 'message/rfc822',
              buffer: contentBuffer,
            });

            console.log(file);

            // Wait 5 seconds
            // await page.waitForTimeout(5000);

            // Submit report
            await page.locator('button[form=report-abuse-form]').last().click();

            page.on('response', async (response) => {
              if (response.status() === 429) {
                console.warn(`Hit 429 Too Many Requests on: ${response.url()}`);
                const data = await response.json();
                console.log(`Response.json: ${data}`);
                page.waitForTimeout(21000);
                page.locator('button[form=report-abuse-form]').last().click();
              }
            });

            // Wait 5 seconds
            if (index < array.length - 1) {
              await page.waitForTimeout(5000);
            }
          });
        }
      });
  } catch (error) {
    console.error(`Error: ${error}`);
  }
});
