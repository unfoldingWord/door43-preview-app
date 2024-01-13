import useFetchZipFileData from '../../core/hooks/useFetchZipFileData'

export function usePopulateSupportReferences({catalogEntry, supportReferences}) {
    const [populatedSupportReferences, setPopulatedSupportReferences] = useState({})

    let zipFileData = null
    try {
      zipFileData = useFetchZipFileData({catalogEntry})
    } catch (e) {
      setErrorMessage(e.message)
    }
  
    useEffect(() => {
        const handlePopulatingSupportReferences = async () => {
            const _populateSupportReferences = JSON.parse(JSON.stringify(supportReferences))
            
            Object.keys(_populateSupportReferences).forEach(rcRef => {
                rcParts = rcRef.split("/")
            
            })
        }

        if(supportReferences && zipFileData) {
            handlePopulatingSupportReferences()
        }
    }, [supportReferences, zipFileData])
}