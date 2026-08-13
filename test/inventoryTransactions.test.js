import assert from "node:assert/strict";
import test from "node:test";

import {
  commitPlayerCurrencyValuePlan,
  createPlayerGoldPaymentPlan,
  getPlayerBankGoldAmount,
  getPlayerGoldAmount,
} from "../src/inventory/inventoryTransactions.js";

const createPlayerWithGold = (quantity, bankGold = 0) => ({
  bank: { goldBalance: bankGold },
  equipment: {
    backpack: {
      itemId: "bag",
      quantity: 1,
      content: [{ itemId: "goldCoin", quantity, uid: quantity }],
    },
  },
});

test("currency queries read only the player passed to them", () => {
  const firstPlayer = createPlayerWithGold(75, 250);
  const secondPlayer = createPlayerWithGold(12, 900);

  assert.equal(getPlayerGoldAmount(firstPlayer), 75);
  assert.equal(getPlayerBankGoldAmount(firstPlayer), 250);
  assert.equal(getPlayerGoldAmount(secondPlayer), 12);
  assert.equal(getPlayerBankGoldAmount(secondPlayer), 900);
});

test("a payment plan mutates only its owning player when committed", () => {
  const payingPlayer = createPlayerWithGold(75);
  const otherPlayer = createPlayerWithGold(40);
  const paymentPlan = createPlayerGoldPaymentPlan(payingPlayer, 20);

  assert.equal(paymentPlan.success, true);
  assert.equal(commitPlayerCurrencyValuePlan(paymentPlan), true);
  assert.equal(getPlayerGoldAmount(payingPlayer), 55);
  assert.equal(getPlayerGoldAmount(otherPlayer), 40);
});
