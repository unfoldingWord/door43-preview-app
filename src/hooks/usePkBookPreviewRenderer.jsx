// eslint-disable-next-line no-unused-vars
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Proskomma } from 'proskomma-core';
import { SofriaRenderFromProskomma } from 'proskomma-json-tools';
import { render } from 'proskomma-json-tools';
import { renderers } from '../renderer/sofria2html'

const defaultFlags = {
  showWordAtts: false,
  showTitles: true,
  showHeadings: true,
  showIntroductions: true,
  showFootnotes: true,
  showXrefs: true,
  showParaStyles: true,
  showCharacterMarkup: true,
  showChapterLabels: true,
  showVersesLabels: true,
};

export default function usePkBookPreviewRenderer(props) {
  const {
    pk,
    docId,
    bookId,
    chapters,
  } = props;

  const [ready, setReady] = useState(false)

  useEffect(() => {
    if ((docId != null) && (pk != null) && (bookId != null)) {
      setReady(true)
    }
  },[bookId, docId, pk])

  const doRender = useCallback(({
    renderFlags,
    verbose,
    extInfo,
  }) => {
    const output = {}
    if ((docId != null) && (pk != null) && (bookId != null)) {
      const renderer = new SofriaRenderFromProskomma({
        proskomma: pk,
        actions: render.sofria2web.renderActions.sofria2WebActions,
      })

      // const r2h = new Render2Html(renderStyles);
      // const renderers = r2h.getRenderers();

      // const renderers = render.sofria2web.sofria2html.renderers;

      const config = {
        ...defaultFlags,
        ...renderFlags,
        bookId,
        extInfo,
        selectedBcvNotes: [],
        renderers,
      }
      if (chapters) {
        config.chapters = chapters;
      }
      try {
        renderer.renderDocument({
          docId,
          config,
          output,
        })
      } catch (err) {
        if (verbose) console.log('Renderer', err)
        throw err
      }
    }
    const styles = render.sofria2web.renderStyles.styleAsCSS(render.sofria2web.renderStyles.styles);
    return `<style type="text/css">${styles}</style>${output.paras}`;
  },[bookId, docId, pk, chapters])

  return {
    ready,
    doRender,
  }
}

 /** Rendering flags *
  renderFlags: PropTypes.objectOf(PropTypes.bool),
  /** Extended info - to be displayed for some verses *
  extInfo: PropTypes.any,
  /** Whether to show extra info in the js console *
  verbose: PropTypes.bool,
  /** Whether to render in html - default is to render React  *
  htmlRender: PropTypes.bool,
*/

usePkBookPreviewRenderer.propTypes = {
  /** Instance of Proskomma class */
  pk: PropTypes.instanceOf(Proskomma),
  /** docId - the id of this document - taken from Proskomma */
  docId: PropTypes.string, 
  /** bookId selector for what content to show in the preview */
  bookId: PropTypes.string,
}