import { registerTelegramBotCredentialProvider } from '../../app/src/platform/telegram-bot-credential-contract.js';

if (process.env.NODE_ENV === 'test' && process.env.SELLIFY_TEST_TELEGRAM_BOT_TOKEN) {
  registerTelegramBotCredentialProvider({
    async getSecret(reference) {
      if (reference !== 'secret://tg11/test') return null;
      return process.env.SELLIFY_TEST_TELEGRAM_BOT_TOKEN;
    },
    async verifyBot() {
      return { ok: true, botId: '111111', botUsername: 'tg11_test_bot' };
    },
  });
}
