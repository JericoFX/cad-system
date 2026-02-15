import en from '~/locales/en.json';

type DictValue = string | Record<string, unknown>;

const dictionaries: Record<string, Record<string, DictValue>> = {
  en: en as Record<string, DictValue>,
};

const locale = (import.meta.env.VITE_LOCALE || 'en').toLowerCase();

function getByPath(dict: Record<string, DictValue>, key: string): string | null {
  const parts = key.split('.');
  let cursor: DictValue | undefined = dict;

  for (let i = 0; i < parts.length; i++) {
    if (!cursor || typeof cursor === 'string') {
      return null;
    }
    const record = cursor as Record<string, DictValue>;
    cursor = record[parts[i]];
  }

  return typeof cursor === 'string' ? cursor : null;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  let output = template;
  for (const key of Object.keys(params)) {
    output = output.split(`{${key}}`).join(String(params[key]));
  }
  return output;
}

export function t(key: string, fallback?: string, params?: Record<string, string | number>): string {
  const active = dictionaries[locale] || dictionaries.en;
  const localized = getByPath(active, key) || getByPath(dictionaries.en, key) || fallback || key;
  return interpolate(localized, params);
}
