import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/** Visible reading column only — excludes the hidden measure pass. */
function readingArea(page: Page) {
  return page.locator(".reading-area:not(.reading-area-measure)");
}

function readingWord(page: Page, word: string) {
  return readingArea(page).getByText(word, { exact: true });
}

/** Welcome words are split into tokens with translation hints interleaved. */
async function waitForWelcomeText(page: Page) {
  await expect(readingWord(page, "nudging")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".reading-pagination-label")).toContainText("%");
}

async function openTextsModal(page: Page) {
  await page.getByRole("button", { name: "Texts" }).click();
  await expect(page.getByRole("dialog", { name: "Texts" })).toBeVisible();
}

async function loadPastedText(page: Page, text: string) {
  await openTextsModal(page);
  await page.getByPlaceholder("Paste your text here...").fill(text);
  await page.getByRole("button", { name: "Load text" }).click();
  await expect(page.getByRole("dialog", { name: "Texts" })).toBeHidden();
}

test.describe("Hint reader UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForWelcomeText(page);
  });

  test("loads the welcome document with toolbar and pagination", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Texts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Known words" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await expect(readingWord(page, "This")).toBeVisible();
    await expect(readingWord(page, "English").first()).toBeVisible();
  });

  test("opens settings and changes translation language", async ({ page }) => {
    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Original language")).toBeVisible();
    await expect(dialog.getByText("Translation language")).toBeVisible();

    // Ant Design Radio.Button hides the native input; click the visible label.
    const translationEnglish = dialog
      .locator(".ant-radio-button-wrapper", { hasText: /^English$/ })
      .last();
    await translationEnglish.click();
    await expect(translationEnglish).toHaveClass(
      /ant-radio-button-wrapper-checked/,
    );

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("pastes text, loads it, and lists it under saved texts", async ({
    page,
  }) => {
    await loadPastedText(page, "Alpha beta gamma delta epsilon.");

    await expect(readingWord(page, "Alpha")).toBeVisible();
    await expect(readingWord(page, "epsilon")).toBeVisible();

    await openTextsModal(page);
    await expect(page.getByText(/Pasted text/)).toBeVisible();
    await expect(page.getByText(/5 words/)).toBeVisible();
  });

  test("opens a .txt book file from the texts modal", async ({ page }) => {
    await openTextsModal(page);

    const fixturePath = path.join(__dirname, "fixtures", "sample.txt");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open book" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    await expect(page.getByRole("dialog", { name: "Texts" })).toBeHidden({
      timeout: 15_000,
    });
    await expect(readingWord(page, "Hello")).toBeVisible();
    await expect(readingWord(page, "world")).toBeVisible();
    await expect(readingWord(page, "sample")).toBeVisible();
  });

  test("marks a word as known from the reading area", async ({ page }) => {
    await page.route("**/translate.googleapis.com/**", async (route) => {
      const url = new URL(route.request().url());
      const word = url.searchParams.get("q") ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([[["hint-" + word, word]]]),
      });
    });

    await loadPastedText(page, "curious elephant wanders freely");
    await expect(readingWord(page, "curious")).toBeVisible();

    // Wait until a translation hint appears so the word is clickable.
    await expect(
      readingArea(page).locator(".translation-with-mask").first(),
    ).not.toHaveText("", { timeout: 20_000 });

    await readingWord(page, "curious").click();

    await page.getByRole("button", { name: "Known words" }).click();
    const knownDialog = page.getByRole("dialog", { name: "Known words" });
    await expect(knownDialog).toBeVisible();
    await expect(
      knownDialog.getByRole("button", { name: "curious" }),
    ).toBeVisible();
  });

  test("bulk-marks CEFR A1 words from the known words modal", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Known words" }).click();
    const dialog = page.getByRole("dialog", { name: "Known words" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("You don't have any known words yet."),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Mark all A1" }).click();
    await expect(
      dialog.getByRole("button", { name: "Unmark all A1" }),
    ).toBeVisible();
    await expect(
      dialog.getByText("You don't have any known words yet."),
    ).toBeHidden();
    await expect(
      dialog.locator(".known-words-list button").first(),
    ).toBeVisible();
  });

  test("rejects unsupported file types with an error message", async ({
    page,
  }) => {
    await openTextsModal(page);

    const fixturePath = path.join(__dirname, "fixtures", "unsupported.csv");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open book" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    await expect(
      page.getByText(
        "Unsupported file type. Use txt, epub, pdf, docx, fb2, or rtf.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Texts" })).toBeVisible();
  });
});
