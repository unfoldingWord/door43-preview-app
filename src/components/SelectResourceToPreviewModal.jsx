import React, { useState, useContext, useEffect } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import Draggable from 'react-draggable'
import TextField from '@mui/material/TextField'
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
  const [availableRefs, setAvailableRefs] = useState(null)
  const [availableBooks, setAvailableBooks] = useState(null)
  const [selectedLanguage, setSelectedLanguage] = useState()
  const [selectedOwner, setSelectedOwner] = useState()
  const [selectedBranchCatalogEntry, setSelectedBranchCatalogEntry] = useState()
  const [refTypeChoice, setRefTypeChoice] = useState('')
  const [selectedRef, setSelectedRef] = useState()
  const [selectedBook, setSelectedBook] = useState()
 
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

  useEffect(() => {
    const fetchBranches = async () => {
      const branches = await repoClient.repoListBranches({owner: selectedOrganization, repo: selectedRepository}).then(({data}) => data).catch(console.error)
      console.log("BRANCHES", branches)
      if (branches.length)
        setAvailableRefs(branches.map(branch => {return {id: branch.name, name: branch.name}}))
      else
        setAvailableRefs(null)
    }

    const fetchTags = async () => {
      const tags = await repoClient.repoListTags({owner: selectedOrganization, repo: selectedRepository}).then(({data}) => data).catch(console.error)
      console.log("TAGS", tags)
      if (tags.length)
        setAvailableRefs(tags.map(tag => {return {id: tag.name, name: tag.name}}))
      else
        setAvailableRefs(null)
    }

    if (selectedOrganization && selectedRepository) {
      console.log(selectedOrganization, selectedRepository, refTypeChoice)
      switch (refTypeChoice) {
        case "branch":
          fetchBranches()
          break
        case "tag":
          fetchTags()
          break
        default:
          setAvailableRefs(null)
      }
    }
  }, [selectedRepository, selectedOwner, refTypeChoice])

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
  
  const handleRefTypeChange = event => {
    console.log(event.target.value)
    setSelectedRef('')
    setRefTypeChoice(event.target.value)
  }

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
      {languages ? 
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
      /> : ""}
      {owners ? 
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
      /> : ""}
      {branchCatalogEntries ? 
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
      /> : ""}
        {selectedBranchCatalogEntry ?
        <FormControl>
          <FormLabel id="ref">Release or Branch</FormLabel>
          <RadioGroup
            aria-labelledby="ref-radio-buttons-group-label"
            defaultValue="prod"
            name="ref-radio-buttons-group"
            row
            value={refTypeChoice}
            onChange={handleRefTypeChange}
          >
            <div>
              {catalogProd ?
                <FormControlLabel
                  value="prod"
                  control={<Radio />}
                  label={"Latest Release ("+catalogProd.branch_or_tag_name+")"} 
                /> : ""}
            <FormControlLabel value="tag" control={<Radio />} label="Tag" />
            </div>
            <div>
              {catalogLatest?<FormControlLabel value="latest" control={<Radio />} label={"Default Branch ("+catalogLatest.branch_or_tag_name+")"} />:""}
            <FormControlLabel value="branch" control={<Radio />} label="Branch" />
            </div>
          </RadioGroup>
        </FormControl> : ""}
        {console.log("AR:", availableRefs)}
        {availableRefs ? <Autocomplete
          id="select-ref"
          value={selectedRef}
          options={ availableRefs }
          getOptionLabel={option => {console.log(option); return option.name}}
          isOptionEqualToValue={(option, value) => {console.log("op", option.id, "val", value, option.id===value); return option.id === value}}
          onChange={(event, ref) => {
            console.log("SELECTED REF", ref)
            setSelectedRef(ref)
          }}
          renderInput={(params) => <TextField {...params} label={refTypeChoice} margin="normal" />}
        />: ""}
        {availableBooks ?
        <Autocomplete
          id="select-book"
          value={selectedBook}
          options={ bookSelectList(availableBooks) }
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(event, book) => {
            setSelectedBook(book)
          }}
          renderInput={(params) => <TextField {...params} label="Book" margin="normal" />}
        /> : ""}      
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
