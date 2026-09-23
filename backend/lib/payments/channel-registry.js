// Provider-neutral payment channel boundary. Channels describe how a payment
// entered Sellify; providers describe who moved/verified the money.

const CHANNELS = Object.freeze([
  { id: 'manual', name: 'Manual', capabilities: { submit: true, parseConfirmation: false, interactive: true } },
  { id: 'sms', name: 'SMS', capabilities: { submit: false, parseConfirmation: true, interactive: false } },
  { id: 'api', name: 'API', capabilities: { submit: true, parseConfirmation: true, interactive: false } },
]);

const channelMap = new Map(CHANNELS.map(channel => [channel.id, channel]));

export function getPaymentChannel(channelId) {
  return channelMap.get(String(channelId || '').trim().toLowerCase()) || null;
}

export function listPaymentChannels() {
  return CHANNELS.map(channel => ({ ...channel, capabilities: { ...channel.capabilities } }));
}

export function requirePaymentChannel(channelId) {
  const channel = getPaymentChannel(channelId);
  if (!channel) {
    const error = new Error(`Unknown payment channel: ${channelId}`);
    error.code = 'UNKNOWN_PAYMENT_CHANNEL';
    error.statusCode = 400;
    throw error;
  }
  return channel;
}
