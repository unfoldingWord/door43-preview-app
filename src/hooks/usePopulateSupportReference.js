import { useEffect, useState } from 'react';
import useFetchZipFileData from '@hooks/useFetchZipFileData';

export function usePopulateSupportReferences({ catalogEntry, supportReferences }) {
  const [populatedSupportReferences, setPopulatedSupportReferences] = useState({});

  const zipFileData = useFetchZipFileData({ catalogEntry, authToken });

  useEffect(() => {
    const handlePopulatingSupportReferences = async () => {
      const _populateSupportReferences = JSON.parse(JSON.stringify(supportReferences));

      Object.keys(_populateSupportReferences).forEach((rcRef) => {
        const rcParts = rcRef.split('/');
      });
    };

    if (supportReferences && zipFileData) {
      handlePopulatingSupportReferences();
    }
  }, [supportReferences, zipFileData]);
}
