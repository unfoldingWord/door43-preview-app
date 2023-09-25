import * as cloneDeep from 'lodash/cloneDeep' // cherry pick just the function we need so webpack can strip unneeded parts

import {
  renderStyles,
  renderStylesRtl,
} from '@oce-editor-tools/core'

export function getRtlPreviewStyle() {
  const _renderStyles = cloneDeep(renderStylesRtl) // make clone to allow for modification without breaking original
  _renderStyles.marks.chapter_label.textIndent = 0
  _renderStyles.paras['usfm:mt'].textAlign = 'right' // move title to right
  return _renderStyles
}

export function getLtrPreviewStyle() {
  const _renderStyles = cloneDeep(renderStyles) // make clone to allow for modification without breaking original
  return _renderStyles
}