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

      // uw-quote-helpers' getTargetQuoteFromSourceQuote only handles numeric `chapter:verse`
      // references: its internal REF_PATTERN is `\d+:\d+` and it runs parseInt() on the verse.
      // Chapter front matter (e.g. a Psalm's \d descriptor) lives under the non-numeric "front"
      // verse key, so quotes there never convert. Alias "front" to the numeric verse key "0" in
      // both the source and target books, and pass a "<chapter>:0" ref for those rows, so the
      // existing alignment lookup works unchanged.
      const aliasFrontToZero = (book) => {
        for (const chapterKey in book) {
          if (book[chapterKey]?.front && !('0' in book[chapterKey])) {
            book[chapterKey]['0'] = book[chapterKey].front;
          }
        }
      };
      aliasFrontToZero(sourceBook);
      targetBooks.forEach((targetBook) => targetBook && aliasFrontToZero(targetBook));

      let data = JSON.parse(JSON.stringify(tsvData));

      for (let chapter in data) {
        for (let verse in data[chapter]) {
          for (let row of data[chapter][verse]) {
            if (row.OrigWords && !row.Quote) {
              row.Quote = row.OrigWords;
            }
            if (row.Quote && !row.Quote.endsWith(':') && row.Occurrence && row.Occurrence != '0') {
              const ref = verse === 'front' ? `${chapter}:0` : row.Reference;
              for (let targetBookIdx in targetBooks) {
                const params = {
                  quote: row.Quote || row.OrigWords,
                  ref,
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
