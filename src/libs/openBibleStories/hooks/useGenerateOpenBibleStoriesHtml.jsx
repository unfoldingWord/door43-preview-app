import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { convertOBSDataToHTML } from '../lib/openBibleStories';

export default function useGenerateOpenBibleStoriesHtml({
  obsData,
  setErrorMessage,
  resolution="360px-compressed",
}) {
  const [html, setHtml] = useState()

  useEffect(() => { 
    if(obsData) {
      convertOBSDataToHTML(obsData, null, resolution).
        then(html => setHtml(html))
    }
  }, [obsData, resolution, setErrorMessage])
  
  return html
}

useGenerateOpenBibleStoriesHtml.propTypes = {
  catalogEntry: PropTypes.object.isRequired,
  zipFileData: PropTypes.object.isRequired,
  resolution: PropTypes.string,
  setErrorMessage: PropTypes.func.isRequired,
};