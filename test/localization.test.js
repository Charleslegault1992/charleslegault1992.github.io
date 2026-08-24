import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { itemsDatabase } from "../src/data/itemsDatabase.js";
import { npcsDatabase } from "../src/data/npcsDatabase.js";
import {
  GAME_CONTENT_TEXT,
  GAME_UI_TEXT,
  getLocalizedItemNameForLanguage,
} from "../src/localization/gameLocalization.js";

test("every item has complete French content", () => {
  for (const itemId of Object.keys(itemsDatabase)) {
    const translation = GAME_CONTENT_TEXT.fr.items[itemId];
    assert.ok(translation, `Missing French item translation: ${itemId}`);
    assert.equal(typeof translation.name, "string", `Missing French name: ${itemId}`);
    assert.equal(typeof translation.pluralName, "string", `Missing French plural name: ${itemId}`);
    assert.equal(typeof translation.desc, "string", `Missing French description: ${itemId}`);
  }
});

test("Ben offers localized names that map to known items", () => {
  for (const itemId of Object.keys(npcsDatabase.ben.service.offers)) {
    assert.ok(itemsDatabase[itemId], `Unknown Ben offer: ${itemId}`);
    assert.notEqual(getLocalizedItemNameForLanguage(itemId, 1, "fr"), itemId);
  }
  assert.equal(getLocalizedItemNameForLanguage("leatherArmor", 1, "fr"), "Armure de cuir");
});

test("English and French expose the same UI translation keys", () => {
  assert.deepEqual(Object.keys(GAME_UI_TEXT.fr).sort(), Object.keys(GAME_UI_TEXT.en).sort());
});

test("every static localized HTML key exists in both languages", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const keys = [...html.matchAll(/data-game-(?:text|title)="([^"]+)"/g)].map((match) => match[1]);
  for (const key of new Set(keys)) {
    assert.ok(key in GAME_UI_TEXT.en, `Missing English UI text: ${key}`);
    assert.ok(key in GAME_UI_TEXT.fr, `Missing French UI text: ${key}`);
  }
});
