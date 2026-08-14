import assert from "node:assert/strict";
import test from "node:test";

import {
  createNetworkMessage,
  decodeNetworkMessage,
  encodeNetworkMessage,
  encodeNetworkPayload,
  SERVER_MESSAGE_TYPE,
} from "../src/network/networkProtocol.js";

test("network messages preserve their version and payload through JSON", () => {
  const message = createNetworkMessage(SERVER_MESSAGE_TYPE.delta, { revision: 4 }, 12);
  const decoded = decodeNetworkMessage(encodeNetworkMessage(message));

  assert.deepEqual(decoded, message);
});

test("server payloads can be encoded directly without cloning their source", () => {
  const payload = { revision: 7, entities: [{ uid: 1 }] };
  const encoded = encodeNetworkPayload(SERVER_MESSAGE_TYPE.delta, payload, 3);

  assert.deepEqual(decodeNetworkMessage(encoded), {
    protocolVersion: 1,
    type: SERVER_MESSAGE_TYPE.delta,
    sequence: 3,
    payload,
  });
});

test("a message from another protocol version is rejected", () => {
  const rawMessage = JSON.stringify({ protocolVersion: 999, type: SERVER_MESSAGE_TYPE.delta, sequence: 0, payload: {} });
  assert.equal(decodeNetworkMessage(rawMessage), null);
});
