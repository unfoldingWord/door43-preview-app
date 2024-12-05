import React, { useState, useEffect } from 'react';
import usePkBookPreviewRenderer from '@hooks/usePkBookPreviewRenderer';
import { Proskomma } from 'proskomma-core';

export default function useUsfmPreviewRenderer(props) {
  const { usfmTexts, bookId, verbose, extInfo, renderFlags, htmlRender, renderStyles, chapters, setErrorMessage } = props;

  // eslint-disable-next-line no-unused-vars
  const [pk, setPk] = useState(new Proskomma());
  const [renderedData, setRenderedData] = useState();
  const [htmlReady, setHtmlReady] = useState(false);
  const [doneImport, setDoneImport] = useState(false);
  const [docId, setDocId] = useState()

  const { ready, doRender } = usePkBookPreviewRenderer({
    pk,
    docId: [],
    bookId,
    renderStyles,
    chapters,
  });

  useEffect(() => {
    const importBooksIntoPk = async () => {
      for(const b in usfmTexts) {
        try {
          const res = pk.importDocument(
            { lang: 'xxx', abbr: 'XXX' }, // doesn't matter...
            'usfm',
            usfmTexts[b],
          );
          if (! res.id ) {
            setErrorMessage('Failed to import book for rendering.');
          } else {
            setDocId(res.id);
          }
        } catch (e) {
          console.log(`Error calling pk.importDocument(): `, e);
          setErrorMessage('Failed to import book for rendering. See console log for details.');
        }
      }
    };

    if (usfmTexts && ! doneImport) {
      setDoneImport(true);
      importBooksIntoPk();
    }
  }, [pk, doneImport, usfmTexts, setErrorMessage]);

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
