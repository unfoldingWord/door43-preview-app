import { useState, useEffect } from 'react';
import { getParsedUSFM, getTargetQuoteFromSourceQuote } from 'uw-quote-helpers';

export default function useFetchGLQuotesForTsvData({ tsvData, sourceUsfm, targetUsfms, quoteTokenDelimiter = ' … ' }) {
  const [renderedData, setRenderedData] = useState();

  useEffect(() => {
    async function doAddGLQuotes() {
      const sourceBook = getParsedUSFM(sourceUsfm).chapters;
      const targetBooks = [];
      for (let targetUsfm of targetUsfms) {
        targetBooks.push(getParsedUSFM(targetUsfm)?.chapters);
      }
      let data = JSON.parse(JSON.stringify(tsvData));

      for (let chapter in data) {
        for (let verse in data[chapter]) {
          for (let row of data[chapter][verse]) {
            if (row.OrigWords && !row.Quote) {
              row.Quote = row.OrigWords;
            }
            if (row.Quote && !row.Quote.endsWith(':') && row.Occurrence && row.Occurrence != '0') {
              for (let targetBookIdx in targetBooks) {
                const params = {
                  quote: row.Quote || row.OrigWords,
                  ref: row.Reference,
                  sourceBook,
                  targetBook: targetBooks[targetBookIdx],
                  options: { occurrence: row.Occurrence, fromOrigLang: true, quoteTokenDelimiter },
                };

                try {
                  let glQuote = getTargetQuoteFromSourceQuote(params);
                  if (quoteTokenDelimiter) {
                    glQuote = glQuote.replace(/ *& */g, quoteTokenDelimiter);
                  }
                  if (glQuote) {
                    row[`GLQuote${targetBookIdx}`] = glQuote;
                  } else {
                    row[`GLQuote${targetBookIdx}`] = '';
                  }
                } catch (e) {
                  row[`GLQuote${targetBookIdx}`] = '';
                }
              }
            } else {
              for (let targetBookIdx in targetBooks) {
                row[`GLQuote${targetBookIdx}`] = '';
              }
            }
          }
        }
      }

      setRenderedData(data);
    }

    if (tsvData && sourceUsfm && targetUsfms?.length) {
      doAddGLQuotes();
    }
  }, [tsvData, sourceUsfm, targetUsfms, quoteTokenDelimiter]);

  return { renderedData };
}
