import { useEffect, useState } from 'react';
import useFetchZipFileData from '@hooks/useFetchZipFileData';

export function usePopulateSupportReferences({ catalogEntry, supportReferences }) {
  // eslint-disable-next-line no-unused-vars
  const [populatedSupportReferences, setPopulatedSupportReferences] = useState({});

  const zipFileData = useFetchZipFileData({ catalogEntry });

  useEffect(() => {
    const handlePopulatingSupportReferences = async () => {
      const _populateSupportReferences = JSON.parse(JSON.stringify(supportReferences));

      Object.keys(_populateSupportReferences).forEach((rcRef) => {
        // eslint-disable-next-line no-unused-vars
        const rcParts = rcRef.split('/');
      });
    };

    if (supportReferences && zipFileData) {
      handlePopulatingSupportReferences();
    }
  }, [supportReferences, zipFileData]);
}
