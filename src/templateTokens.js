export const TEMPLATE_TOKEN_RE = /\{\{\s*([A-Za-z_]+)(?::([^}]*?))?\s*\}\}/g;

export function renderTokens(tokens, template, context = {}) {
  return String(template ?? '').replace(TEMPLATE_TOKEN_RE, (match, name, arg) => {
    const resolver = tokens[String(name).toUpperCase()];
    if (!resolver) return match;
    const value = resolver(context, arg);
    return value == null ? match : String(value);
  });
}

export function unknownTemplateTokens(tokens, template, probeContext = {}) {
  const found = [];
  for (const match of String(template ?? '').matchAll(TEMPLATE_TOKEN_RE)) {
    const resolver = tokens[String(match[1]).toUpperCase()];
    const unresolved = !resolver || resolver(probeContext, match[2]) == null;
    if (unresolved && !found.includes(match[0])) found.push(match[0]);
  }
  return found;
}
