// eslint-disable-next-line no-unused-vars
import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import { getParsedUSFM, getTargetQuoteFromSourceQuote} from 'uw-quote-helpers'

export default function useTsvGLQuoteAdder({
  tsvText,
  sourceUsfm,
  targetUsfm,
  quoteTokenDelimiter = " … ",
}) {
  const [renderedData, setRenderedData] = useState()

  useEffect(() => {
    async function doAddGLQuotes() {
      const data = Papa.parse(tsvText, {delimiter: '\t', header: true})
      const rows = data.data

      const sourceBook = getParsedUSFM(sourceUsfm).chapters
      let targetBook = getParsedUSFM(targetUsfm).chapters

      rows.forEach(row => {
        let ref = ""
        if (row.Chapter) {
          ref = row.Chapter + ":" + row.Verse
          row.Reference = ref
        } else {
          ref = row.Reference
        }
        if (row.OccurrenceNote) {
          row.Note = row.OccurrenceNote
        }
        if (row.Quote || row.OrigQuote) {
          let quote = ""
          if (row.OrigQuote) {
            row.Quote = quote
          } else {
            quote = row.Quote
          }  
          const occurrence = row.Occurrence
          const params = {
            quote,
            ref,
            sourceBook,
            targetBook,
            options: { occurrence, fromOrigLang: true },
          }
          if (quote && occurrence && occurrence != "0") {
            // console.log(`Generating target quote matching source quote`)
            try {
              let glQuote = getTargetQuoteFromSourceQuote(params)
              if (quoteTokenDelimiter) {
                glQuote = glQuote.replaceAll(' & ', quoteTokenDelimiter)
              }
              row.GLQuote = glQuote
              if (!row.GLQuote) {
                row.GLQuote = ""
              }
            } catch (e) {
              row.GLQuote = ""
            }
          } else {
            row.GLQuote = row.GLQuote || ""
          }
        }
      })

      setRenderedData(rows)
    }

    if (tsvText && sourceUsfm && targetUsfm) {
      doAddGLQuotes()
    }
  }, [tsvText, sourceUsfm, targetUsfm])

  return renderedData
}
