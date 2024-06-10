import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { convertOBSDataToHTML } from '@helpers/obs_helpers';

export default function useGenerateOpenBibleStoriesHtml({ obsData, setErrorMessage, resolution = '360px', chapters }) {
  const [htmlSections, setHtmlSections] = useState();

  useEffect(() => {
    if (obsData) {
      convertOBSDataToHTML(obsData, null, resolution, chapters).then((sections) => setHtmlSections(sections));
    }
  }, [obsData, chapters, resolution, setErrorMessage]);

  return htmlSections;
}

useGenerateOpenBibleStoriesHtml.propTypes = {
  catalogEntry: PropTypes.object.isRequired,
  zipFileData: PropTypes.object.isRequired,
  resolution: PropTypes.string,
  setErrorMessage: PropTypes.func.isRequired,
};
