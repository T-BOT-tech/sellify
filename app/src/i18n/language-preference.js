// The interface language is a local user preference, independent of business
// country, currency, jurisdiction, or provider readiness.
export function persistLanguagePreference(config, lang, saveConfig) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Language preference requires an app config object.');
  }
  if (typeof saveConfig !== 'function') {
    throw new TypeError('Language preference requires a config persistence callback.');
  }

  config.lang = lang;
  saveConfig(config);
  return config;
}
