import { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { convertOBSDataToHTML } from '@helpers/obs_helpers';
import { AppContext } from '@components/App.context';

export default function useGenerateOpenBibleStoriesHtml({ obsData, resolution = '360px-compressed', chapters }) {
  const [htmlSections, setHtmlSections] = useState();
  const {
    actions: { setErrorMessage }
  } = useContext(AppContext);

  useEffect(() => {
    if (obsData) {
      convertOBSDataToHTML(obsData, null, resolution, chapters).then((sections) => setHtmlSections(sections));
    }
  }, [obsData, resolution, chapters, setErrorMessage]);

  return htmlSections;
}

useGenerateOpenBibleStoriesHtml.propTypes = {
  catalogEntry: PropTypes.object.isRequired,
  zipFileData: PropTypes.object.isRequired,
  resolution: PropTypes.string,
  setErrorMessage: PropTypes.func.isRequired,
};
