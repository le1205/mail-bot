const fs = require("fs/promises");
const { faker } = require("@faker-js/faker");
const pt = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
pt.use(StealthPlugin());

const AdblockerPlugin = require("puppeteer-extra-plugin-adblocker");
pt.use(
  AdblockerPlugin({
    interceptResolutionPriority: 0, // const { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } = require('puppeteer')
  })
);

const PASSWORD = "future417";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const signup = async (page, emailAddress) => {
  await page.waitForSelector(
    'div#onetrust-close-btn-container button[aria-label="Close"]'
  );
  await page.$eval(
    'div#onetrust-close-btn-container button[aria-label="Close"]',
    (el) => el.click()
  );

  await page.waitForSelector('[data-qa="work"]', { timeout: 300000 });
  await page.$eval('[data-qa="work"]', (el) => el.click());
  await page.$eval(`button[type="button"][data-qa="btn-apply"]`, (el) =>
    el.click()
  );

  await page.waitForSelector("#first-name-input");
  await page.type("#first-name-input", faker.person.firstName("male"));
  await page.type("#last-name-input", faker.person.lastName("male"));
  await page.type("#redesigned-input-email", emailAddress);
  await page.type("#password-input", PASSWORD);
  await page.waitForSelector('[aria-labelledby*="select-a-country"]');
  await delay(1500);
  await page.$eval('[aria-labelledby*="select-a-country"]', (el) => el.click());
  await page.waitForSelector('[autocomplete="country-name"]');
  await page.type('[autocomplete="country-name"]', "switzerland");
  await page.$eval('[aria-labelledby="select-a-country"] li', (el) =>
    el.click()
  );
  await delay(500);
  await page.$eval("#checkbox-terms", (el) => el.click());
  await delay(500);
  await page.$eval("#button-submit-form", (el) => el.click());

  await delay(8000);
};

const checkConnect = async (page, emailAddress) => {
  await page.goto("https://www.upwork.com/nx/create-profile/", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("ul.welcome-step1-list");
  await delay(1500);
  const listCount = await page.evaluate(() => {
    return Array.from(document.querySelector("ul.welcome-step1-list").children)
      .length;
  });
  if (listCount == 3) {
    try {
      await fs.access("accounts.txt");
      await fs.appendFile("accounts.txt", emailAddress + "\n");
    } catch (err) {
      await fs.writeFile("accounts.txt", emailAddress + "\n");
      console.error(`Error accessing file: ${err}`);
    }
    return true;
  }
  return false;
};

const readMail = async (page) => {
  await page.waitForSelector(
    "div.actions.grid.grid-cols-4.gap-3 div:nth-child(1)"
  );
  await page.$eval(
    "div.actions.grid.grid-cols-4.gap-3 div:nth-child(1)",
    (el) => el.click()
  );
  do {
    await delay(1500);
    try {
      await page.waitForSelector(
        "div.mailbox div.list div.messages div:nth-child(1)",
        { timeout: 3000 }
      );
      await page.$eval(
        "div.mailbox div.list div.messages div:nth-child(1)",
        (el) => el.click()
      );
      break;
    } catch {}
  } while (true);
  await page.waitForSelector("div.text-wrap.py-4.px-7 iframe");
  const iframeElement = await page.$("div.text-wrap.py-4.px-7 iframe");
  const iframe = await iframeElement.contentFrame();
  if (iframe) {
    await iframe.waitForSelector("a");
    const hrefs = await iframe.evaluate(() => {
      const links = document.querySelectorAll("a");
      return Array.from(links).map((link) => link.href);
    });
    return hrefs[1];
  }
  return "";
};

(async () => {
  while (true) {
    const start = performance.now();
    const browser = await pt.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const etempMail = await browser.newPage();
    await etempMail.goto("https://etempmail.net/mailbox");
    let emailAddress = "";
    do {
      await delay(3000);
      await etempMail.waitForSelector("#email_id");
      const element = await etempMail.$("#email_id");
      emailAddress = await etempMail.evaluate((el) => el.textContent, element);
    } while (emailAddress == "");
    console.log(emailAddress);
    const upwork = await browser.newPage();
    await upwork.goto("https://www.upwork.com/nx/signup/?dest=home", {
      waitUntil: "domcontentloaded",
    });

    await signup(upwork, emailAddress);

    const verify_link = await readMail(etempMail);
    await upwork.goto(verify_link, {
      waitUntil: "domcontentloaded",
    });

    await delay(5000);

    const hasConnect = await checkConnect(upwork, emailAddress);

    await browser.close();

    const end = performance.now();
    console.log(
      emailAddress +
        " => " +
        ((end - start) / 1e3).toFixed(2) +
        "s : " +
        hasConnect
    );
    await delay(20000 + Math.random() * 18000);
  }
})();
