import React, { useState, useContext, useEffect } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import Draggable from 'react-draggable'
import TextField from '@mui/material/TextField'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'


export default function SelectResourceToPreviewModal(
{
  showModal,
  setShowModal,
  baseCatalogApiUrl,
  catalogEntry,
}) {
  const [languages, setLanguages] = useState()
  const [owners, setOwners] = useState()
  const [branchCatalogEntries, setBranchCatalogEntries] = useState()
  const [selectedLanguage, setSelectedLanguage] = useState()
  const [selectedOwner, setSelectedOwner] = useState()
  const [selectedBranchCatalogEntry, setSelectedBranchCatalogEntry] = useState()

  useEffect(() => {
    const getLanguages = async () => {
      fetch(`${baseCatalogApiUrl}/list/languages?stage=branch&metadataType=rc&metadataType=sb&metadataType=tc`)
      .then(response => {
        return response.json()
      })
      .then(({data}) => {
        setLanguages(data)
      }).catch(e => {
        console.log("Error getting languages")
        console.log(e)
      })
    }
    
    getLanguages()
  }, [])

  useEffect(() => {
    if(catalogEntry) {
      if (!selectedLanguage) {
        setSelectedLanguage({lc: catalogEntry.language, ang: catalogEntry.language_title})
      }
      if (!selectedOwner) {
        setSelectedOwner(catalogEntry.repo.owner)
      }
      if (!selectedBranchCatalogEntry) {
        setSelectedBranchCatalogEntry(catalogEntry)
      }
    }
  }, [catalogEntry])

  useEffect(() => {
    const getOwners = async () => {
      fetch(`${baseCatalogApiUrl}/list/owners?stage=branch&metadataType=rc&metadataType=sb&metadataType=tc&lang=${encodeURIComponent(selectedLanguage.lc)}`)
      .then(response => {
        return response.json()
      })
      .then(({data}) => {
        setOwners(data)
      }).catch(e => {
        console.log("Error getting owners")
        console.log(e)
      })
    }
    
    if (selectedLanguage) {
      getOwners()
    }
  }, [selectedLanguage])

  useEffect(() => {
    const getBranchCatalogEntries = async () => {
      fetch(`${baseCatalogApiUrl}/search?stage=branch&metadataType=rc&metadataType=sb&metadataType=tc&lang=${encodeURIComponent(selectedLanguage.lc)}&owner=${encodeURIComponent(selectedOwner.username)}`)
      .then(response => {
        return response.json()
      })
      .then(({data}) => {
        setBranchCatalogEntries(data)
      }).catch(e => {
        console.log("Error getting catalog entries via search of stage branch")
        console.log(e)
      })
    }
    
    if (selectedLanguage && selectedOwner) {
      getBranchCatalogEntries()
    }
  }, [selectedLanguage, selectedOwner])

  const nodeRef = React.useRef(null);

  const handleSelectResource = (data) => {
    if (selectedBranchCatalogEntry) {
      window.location.href = `/u/${selectedBranchCatalogEntry.full_name}`
    }
    setShowModal(false)
  }

  const PaperComponent = (props) => {
    return (
      <Draggable
        nodeRef={nodeRef}
        handle="#draggable-dialog-title"
        cancel={'[class*="MuiDialogContent-root"]'}
      >
        <Paper {...props} />
      </Draggable>
    )
  }

  const top100Films = [
    { label: 'The Shawshank Redemption', year: 1994 },
    { label: 'The Godfather', year: 1972 },
    { label: 'The Godfather: Part II', year: 1974 },
    { label: 'The Dark Knight', year: 2008 },
    { label: '12 Angry Men', year: 1957 },
    { label: "Schindler's List", year: 1993 },
  ]

  const filterOptions = createFilterOptions({
    stringify: (option) => option.ang + " " + option.lc,
  });
  

  return(
    <Dialog
    open={showModal}
    onClose={() => setShowModal(false)}
    PaperComponent={PaperComponent}
    aria-labelledby="draggable-dialog-title"
  >
    <DialogTitle style={{ cursor: 'move' }} ref={nodeRef}>
      Preview a Resource
    </DialogTitle>
    <DialogContent>
      {languages && 
      <Autocomplete
        id="language-select"
        sx={{ width: 300, paddingTop: "5px" }}
        options={languages}
        autoHighlight
        clearOnEscape
        defaultValue={selectedLanguage}
        getOptionLabel={option => option.lc + ": "+ option.ang }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Language"
            variant="outlined"          
          />
        )}
        isOptionEqualToValue={(option, value) => option.lc === value.lc}
        onChange={
          (event, option) => {
            console.log(option.lc)
            if (! selectedLanguage || option.lc != selectedLanguage.lc) {
              setSelectedLanguage(option)
              setOwners()
              setSelectedOwner()
              setBranchCatalogEntries()
              setSelectedBranchCatalogEntry()
            } 
          }
        }
      />}
      {owners && 
      <Autocomplete
        id="owner-select"
        sx={{ width: 300, paddingTop: "5px" }}
        options={owners}
        autoHighlight
        clearOnEscape
        defaultValue={selectedOwner}
        getOptionLabel={option => (option.full_name ? `${option.full_name} (${option.username})` : option.username )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Provider"
            variant="outlined"          
          />
        )}
        isOptionEqualToValue={(option, value) => option.username === value.username}
        onChange={
          (event, option) => {
            console.log(option.username)
            if(!selectedOwner || selectedOwner.username != option.username) {
              setSelectedOwner(option)
              setBranchCatalogEntries()
              setSelectedBranchCatalogEntry()
            }
          }
        }
      />}
      {branchCatalogEntries && 
      <Autocomplete
        id="branch-catalog-entry-select"
        sx={{ width: 300, paddingTop: "5px" }}
        options={branchCatalogEntries}
        autoHighlight
        clearOnEscape
        defaultValue={selectedBranchCatalogEntry}
        getOptionLabel={option => `${option.name} (${option.subject})`}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Repository"
            variant="outlined"          
          />
        )}
        isOptionEqualToValue={(option, value) => option.full_name === value.full_name}
        onChange={
          (event, option) => {
            console.log(option.full_name)
            if(!selectedBranchCatalogEntry || selectedBranchCatalogEntry.full_name != option.full_name) {
              setSelectedBranchCatalogEntry(option)
            }
          }
        }
      />}
    </DialogContent>
    <DialogActions>
      <Button autoFocus onClick={()=>setShowModal(false)}>
        Cancel
      </Button>
      <Button onClick={handleSelectResource}>Select</Button>
    </DialogActions>
  </Dialog>
  )
}
