import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getOBSData } from '../helpers/obs_helpers';

export default function useGetOBSData({ catalogEntry, zipFileData, setErrorMessage }) {
  const [obsData, setObsData] = useState();

  useEffect(() => {
    const fetchOBSData = async () => {
      try {
        let data = await getOBSData(catalogEntry, zipFileData);
        setObsData(data);
      } catch (e) {
        setErrorMessage(e.message);
      }
    };

    if (catalogEntry && zipFileData) {
      fetchOBSData();
    }
  }, [catalogEntry, zipFileData, setErrorMessage]);

  return obsData;
}

useGetOBSData.propTypes = {
  catalogEntry: PropTypes.object.isRequired,
  zipFileData: PropTypes.object.isRequired,
  setErrorMessage: PropTypes.func.isRequired,
};
