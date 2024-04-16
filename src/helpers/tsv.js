import Papa from 'papaparse';

export function parseTsvText(tsvText) {
  return new Promise((resolve, reject) => {
    Papa.parse(tsvText, {
      header: true,
      delimiter: '\t',
      complete: (results) => {
        const data = {};
        results.data.forEach((row) => {
          if (!row.ID) {
            return;
          }
          if (row.Chapter && row.Verse) {
            row.Reference = `${row.Chapter}:${row.Verse}`;
            row.Note = row.OccurrenceNote;
            row.Quote = row.OrigQuote;
            if (row.SupportReference && !row.SupportReference.includes('/')) {
              row.SupportReference = `rc://*/ta/man/translate/${row.SupportReference}`;
            }
          }
          const reference = row.Reference?.split(':');
          const chapter = reference[0];
          const verse = reference[1];
          const first_verse = verse.split(',')[0].split('-')[0];
          if (!data[chapter]) {
            data[chapter] = {};
          }
          if (!data[chapter][first_verse]) {
            data[chapter][first_verse] = [];
          }
          data[chapter][first_verse].push(row);
        });
        resolve(data);
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
