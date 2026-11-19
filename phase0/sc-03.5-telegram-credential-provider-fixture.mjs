import { registerTelegramBotCredentialProvider } from '../app/src/platform/telegram-bot-credential-contract.js';

registerTelegramBotCredentialProvider({
  async getSecret(reference) {
    return reference === 'secret://sc035/test' ? '123456:SC035_TEST_BOT_TOKEN' : null;
  },
  async verifyBot() {
    return { ok: true, botId: '123456', botUsername: 'sc035_test_bot' };
  },
});
