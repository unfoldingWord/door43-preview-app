import React, { useState, useEffect } from 'react';
import usePkBookPreviewRenderer from '@hooks/usePkBookPreviewRenderer';
import { Proskomma } from 'proskomma-core';

export default function useUsfmPreviewRenderer(props) {
  const { bookId, usfmText, verbose, extInfo, renderFlags, htmlRender, renderStyles, chapters, setErrorMessage } = props;

  const [docId, setDocId] = useState();
  // eslint-disable-next-line no-unused-vars
  const [pk, setPk] = useState(new Proskomma());
  const [renderedData, setRenderedData] = useState();
  const [importedBookDocIds, setImportedBookDocIds] = useState({});
  const [htmlReady, setHtmlReady] = useState(false);

  const { ready, doRender } = usePkBookPreviewRenderer({
    pk,
    docId,
    bookId,
    renderStyles,
    chapters,
  });

  useEffect(() => {
    const importBookIntoPk = async () => {
      try {
        const res = pk.importDocument(
          { lang: 'xxx', abbr: 'XXX' }, // doesn't matter...
          'usfm',
          usfmText
        );
        if (res.id !== undefined) {
          setImportedBookDocIds((prevState) => ({ ...prevState, [bookId]: res.id }));
          setDocId(res.id);
        } else {
          setErrorMessage('Failed to import book for rendering.');
        }
      } catch (e) {
        console.log(`Error calling pk.importDocument(): `, e);
        setErrorMessage('Failed to import book for rendering. See console log for details.');
      }
    };

    if (pk && usfmText && bookId) {
      if (!(bookId in importedBookDocIds)) {
        importBookIntoPk();
      } else {
        setDocId(importedBookDocIds[bookId]);
      }
    }
  }, [pk, usfmText, bookId, importedBookDocIds, setErrorMessage]);

  useEffect(() => {
    const callDoRender = async () => {
      const data = doRender({ renderFlags, extInfo, verbose, htmlRender });
      setRenderedData(data);
      setHtmlReady(true);
    };

    if (pk && ready && doRender && !renderedData) {
      callDoRender();
    }
  }, [pk, doRender, extInfo, renderFlags, verbose, ready, htmlRender, renderedData]);

  return { renderedData, htmlReady };
}