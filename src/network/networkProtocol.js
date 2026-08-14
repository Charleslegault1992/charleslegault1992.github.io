export const NETWORK_PROTOCOL_VERSION = 1;

export const CLIENT_MESSAGE_TYPE = Object.freeze({
  hello: "client.hello",
  action: "client.action",
  acknowledge: "client.acknowledge",
  requestSnapshot: "client.request-snapshot",
  ping: "client.ping",
});

export const SERVER_MESSAGE_TYPE = Object.freeze({
  welcome: "server.welcome",
  snapshot: "server.snapshot",
  delta: "server.delta",
  actionResult: "server.action-result",
  events: "server.events",
  error: "server.error",
  pong: "server.pong",
});

const NETWORK_MESSAGE_TYPES = new Set([
  ...Object.values(CLIENT_MESSAGE_TYPE),
  ...Object.values(SERVER_MESSAGE_TYPE),
]);

export const createNetworkMessage = (type, payload, sequence = 0) => {
  if (!NETWORK_MESSAGE_TYPES.has(type) || !Number.isSafeInteger(sequence) || sequence < 0) {
    return null;
  }
  return Object.freeze({
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    type,
    sequence,
    payload: structuredClone(payload ?? null),
  });
};

export const isValidNetworkMessage = (message) => {
  return (
    message?.protocolVersion === NETWORK_PROTOCOL_VERSION &&
    NETWORK_MESSAGE_TYPES.has(message.type) &&
    Number.isSafeInteger(message.sequence) &&
    message.sequence >= 0 &&
    "payload" in message
  );
};

export const encodeNetworkMessage = (message) => {
  return isValidNetworkMessage(message) ? JSON.stringify(message) : null;
};

export const encodeNetworkPayload = (type, payload, sequence = 0) => {
  if (!NETWORK_MESSAGE_TYPES.has(type) || !Number.isSafeInteger(sequence) || sequence < 0) {
    return null;
  }
  return JSON.stringify({
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    type,
    sequence,
    payload: payload ?? null,
  });
};

export const decodeNetworkMessage = (rawMessage) => {
  if (typeof rawMessage !== "string") {
    return null;
  }
  try {
    const message = JSON.parse(rawMessage);
    return isValidNetworkMessage(message) ? message : null;
  } catch {
    return null;
  }
};
