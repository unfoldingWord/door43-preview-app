import { useState, useEffect, useMemo } from 'react';
import { adddGLQuoteCols } from 'tsv-quote-converters'

// Function to generate SHA-256 hash for params object
async function generateParamsHash(params) {
  const paramsString = JSON.stringify(params, Object.keys(params).sort());
  const msgUint8 = new TextEncoder().encode(paramsString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function useFetchGLQuotesForTsvData({ tsvData, sourceUsfm, targetUsfms, quoteTokenDelimiter = ' … ', ol2GlQuoteDictionary = {} }) {
  const [renderedData, setRenderedData] = useState();
  const [newOl2GlQuoteDictionary, setNewOl2GlQuoteDictionary] = useState({});

  useEffect(() => {
    async function doAddGLQuotes() {
      const sourceBook = getParsedUSFM(sourceUsfm).chapters;
      const targetBooks = [];
      for (let targetUsfm of targetUsfms) {
        targetBooks.push(getParsedUSFM(targetUsfm)?.chapters);
      }
      let data = JSON.parse(JSON.stringify(tsvData));
      let ol2GlDict = {};

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
                  // Generate unique hash for params
                  const paramsHash = await generateParamsHash(params);

                  // Check if hash exists in ol2GlQuoteDictionary
                  if (ol2GlQuoteDictionary[paramsHash]) {
                    row[`GLQuote${targetBookIdx}`] = ol2GlQuoteDictionary[paramsHash];
                    ol2GlDict[paramsHash] = {
                      ref: params.ref,
                      targetBookIdx: targetBookIdx,
                      occurrence: params.options.occurrence,
                      fromOrigLang: params.options.fromOrigLang,
                      quoteTokenDelimiter: params.options.quoteTokenDelimiter,
                      ol: params.quote,
                      gl: ol2GlQuoteDictionary[paramsHash],
                    }; // Store in new dictionary
                  } else {
                    // Fallback to original quote generation logic
                    let glQuote = getTargetQuoteFromSourceQuote(params);
                    if (quoteTokenDelimiter) {
                      glQuote = glQuote.replace(/ *& */g, quoteTokenDelimiter);
                    }
                    if (glQuote) {
                      ol2GlDict[paramsHash] = {
                        ref: params.ref,
                        targetBookIdx: targetBookIdx,
                        occurrence: params.options.occurrence,
                        fromOrigLang: params.options.fromOrigLang,
                        quoteTokenDelimiter: params.options.quoteTokenDelimiter,
                        ol: params.quote,
                        gl: glQuote,
                      };
                      row[`GLQuote${targetBookIdx}`] = glQuote;
                    } else {
                      row[`GLQuote${targetBookIdx}`] = '';
                    }
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
      console.log('SETTING NEW OL2GL QUOTE DICTIONARY:', ol2GlDict);
      setNewOl2GlQuoteDictionary(ol2GlDict);
    }

    if (tsvData && sourceUsfm && targetUsfms?.length && ol2GlQuoteDictionary) {
      doAddGLQuotes();
    }
  }, [tsvData, sourceUsfm, targetUsfms, quoteTokenDelimiter, ol2GlQuoteDictionary]);

  // Stabilize the dictionary reference to prevent unnecessary re-renders
  const stableNewOl2GlQuoteDictionary = useMemo(() => {
    return Object.keys(newOl2GlQuoteDictionary).length > 0 ? newOl2GlQuoteDictionary : null;
  }, [JSON.stringify(newOl2GlQuoteDictionary)]);

  return { renderedData, newOl2GlQuoteDictionary: stableNewOl2GlQuoteDictionary };
}
