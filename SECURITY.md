# Security Policy

## Supported release line

Sellify currently targets **Node.js 24+**. Do not treat Node.js 22 regression evidence as Node 24 release certification.

## Reporting a vulnerability

Please do not publish credentials, tokens, personal data, or exploit details in a public issue. Report security concerns privately to the repository maintainers through the repository's available private security-reporting mechanism.

When reporting, include:
- affected component and version/commit;
- reproduction steps or a minimal proof of concept;
- expected versus observed behavior;
- impact assessment, if known.

## Secrets

Never commit `.env`, API tokens, Telegram bot tokens, payment credentials, private keys, database files, or production backups. Use `.env.example` as the configuration template.
