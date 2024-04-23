export const insertUnmatchedCurlyBracesInQuote = (quote, scripture, quoteTokenDelimiter = ' … ') => {
  const quoteParts = quote.split(quoteTokenDelimiter);
  quoteParts.forEach((part, idx) => {
    if (/^[^{]*\}/.test(part)) {
      if (scripture.includes(`{${part}`)) {
        quoteParts[idx] = `{${part}`;
      } else {
        quoteParts[idx] = `{${quoteTokenDelimiter}${part}`
      }
    }
    if (/\{[^}]*$/.test(part)) {
      if (scripture.includes(`${part}}`)) {
        quoteParts[idx] = `${part}}`;
      } else {
        quoteParts[idx] = `${part}${quoteTokenDelimiter}}`
      }
    }
  });
  return quoteParts.join(quoteTokenDelimiter);
};