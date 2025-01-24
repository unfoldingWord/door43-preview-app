import { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { getOBSData } from '@helpers/obs_helpers';
import { AppContext } from '@components/App.context';

export default function useGetOBSData({ catalogEntry, zipFileData }) {
  const [obsData, setObsData] = useState();
  const {
    actions: { setErrorMessage }
  } = useContext(AppContext);

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
