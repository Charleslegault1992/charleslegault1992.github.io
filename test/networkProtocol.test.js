import assert from "node:assert/strict";
import test from "node:test";

import {
  createNetworkMessage,
  decodeNetworkMessage,
  encodeNetworkMessage,
  SERVER_MESSAGE_TYPE,
} from "../src/network/networkProtocol.js";

test("network messages preserve their version and payload through JSON", () => {
  const message = createNetworkMessage(SERVER_MESSAGE_TYPE.delta, { revision: 4 }, 12);
  const decoded = decodeNetworkMessage(encodeNetworkMessage(message));

  assert.deepEqual(decoded, message);
});

test("a message from another protocol version is rejected", () => {
  const rawMessage = JSON.stringify({ protocolVersion: 999, type: SERVER_MESSAGE_TYPE.delta, sequence: 0, payload: {} });
  assert.equal(decodeNetworkMessage(rawMessage), null);
});
