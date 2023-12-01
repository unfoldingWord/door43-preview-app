import { cloneDeep } from 'lodash' // cherry pick just the function we need so webpack can strip unneeded parts

import {
  renderStyles,
  renderStylesRtl,
} from '@oce-editor-tools/base'

export function getRtlPreviewStyle() {
  const _renderStyles = cloneDeep(renderStylesRtl) // make clone to allow for modification without breaking original
  _renderStyles.marks.chapter_label.textIndent = 0
  _renderStyles.paras['usfm:mt'].textAlign = 'right' // move title to right
  _renderStyles.paras.default.fontFamily = 'Ezra, CharisSIL' // use Ezra font for Hebrew characters and then falls back to Charis for other characters
  return _renderStyles
}

export function getLtrPreviewStyle() {
  const _renderStyles = cloneDeep(renderStyles) // make clone to allow for modification without breaking original
  _renderStyles.marks.chapter_label.textIndent = 0
  _renderStyles.paras.default.fontFamily = 'CharisSIL'
  return _renderStyles
}