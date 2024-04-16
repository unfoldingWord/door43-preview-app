// eslint-disable-next-line no-unused-vars
import { useState, useEffect } from 'react';
import { getParsedUSFM, getTargetQuoteFromSourceQuote } from 'uw-quote-helpers';
import { parseTsvText } from '@helpers/tsv';

export default function useTsvDataStandardizer({ tsvText, sourceUsfm, targetUsfm, quoteTokenDelimiter = ' … ' }) {
  const [tsvData, setTsvData] = useState();
  const [renderedData, setRenderedData] = useState();

  useEffect(() => {
    const tsvIntoDataStructure = async () => {
      const data = await parseTsvText(tsvText);
      setTsvData(data);
    };

    if (tsvText) {
      tsvIntoDataStructure();
    }
  }, [tsvText]);

  useEffect(() => {
    async function doAddGLQuotes() {
      const sourceBook = getParsedUSFM(sourceUsfm).chapters;
      let targetBook = getParsedUSFM(targetUsfm).chapters;
      let data = JSON.parse(JSON.stringify(tsvData));

      for (let chapter in data) {
        for (let verse in data[chapter]) {
          for (let row of data[chapter][verse]) {
            if (row.Quote && row.Occurrence && row.Occurrence != '0') {
              const params = {
                quote: row.Quote || row.OrigWords,
                ref: row.Reference,
                sourceBook,
                targetBook,
                options: { occurrence: row.Occurrence, fromOrigLang: true },
              };
              try {
                let glQuote = getTargetQuoteFromSourceQuote(params);
                if (quoteTokenDelimiter) {
                  glQuote = glQuote.replaceAll(' & ', quoteTokenDelimiter);
                }
                if (glQuote) {
                  row.GLQuote = glQuote;
                }
                if (!row.GLQuote) {
                  row.GLQuote = '';
                }
              } catch (e) {
                row.GLQuote = '';
              }
            } else {
              row.GLQuote = row.GLQuote || '';
            }
          }
        }
      }

      setRenderedData(data);
    }

    if (tsvData && sourceUsfm && targetUsfm) {
      doAddGLQuotes();
    }
  }, [tsvData, sourceUsfm, targetUsfm, quoteTokenDelimiter]);

  return renderedData;
}
