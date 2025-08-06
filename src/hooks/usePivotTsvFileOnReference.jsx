import { useState, useEffect } from 'react';
import { parseTsvText } from '@helpers/tsv';

export default function usePivotTsvFileOnReference({ tsvBookFile }) {
  const [tsvData, setTsvData] = useState();

  useEffect(() => {
    const tsvIntoDataStructure = async () => {
      const data = await parseTsvText(tsvBookFile);
      setTsvData(data);
    };

    if (tsvBookFile) {
      tsvIntoDataStructure();
    }
  }, [tsvBookFile]);

  return tsvData;
}
