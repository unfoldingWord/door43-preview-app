import React, { useState, useContext, useEffect } from 'react'
import { API_PATH } from '@common/constants'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import Draggable from 'react-draggable'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import FormControlLabel from '@mui/material/FormControlLabel'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/joy/CircularProgress'
import { styled } from "@mui/material";

const StyledTextField = styled(TextField)(() => ({
  "& .MuiFormLabel-asterisk": {
    color: "red"
  }
}))

export default function SelectResourceToPreviewModal(
{
  canLoad,
  showModal,
  setShowModal,
  serverInfo,
  urlInfo,
  currentCatalogEntry,
}) {
  const [languages, setLanguages] = useState()
  const [owners, setOwners] = useState({})
  const [repos, setRepos] = useState({})
  const [availableRefs, setAvailableRefs] = useState({})
  const [catalogEntry, setCatalogEntry] = useState()
  const [availableBooks, setAvailableBooks] = useState({})
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState()
  const [selectedLanguage, setSelectedLanguage] = useState({lc: "en", ang: "English"})
  const [selectedOwner, setSelectedOwner] = useState()
  const [selectedRepo, setSelectedRepo] = useState()
  const [refTypeChoice, setRefTypeChoice] = useState('')
  const [selectedRef, setSelectedRef] = useState()
  const [selectedBook, setSelectedBook] = useState()

  useEffect(() => {
    if(currentCatalogEntry) {
      if (!selectedLanguage) {
        setSelectedLanguage({lc: currentCatalogEntry.language, ang: currentCatalogEntry.language_title})
      }
      if (!selectedOwner) {
        setSelectedOwner(currentCatalogEntry.repo.owner)
      }
      if (!selectedRepo) {
        setSelectedRepo(currentCatalogEntry.repo)
      }
      if (!refTypeChoice) {
        setRefTypeChoice(currentCatalogEntry.ref_type)
      }
      if (!selectedRef) {
        setSelectedRef(currentCatalogEntry.branch_or_tag_name)
      }
    }
    if(urlInfo && urlInfo.hashParts[0]) {
      setSelectedBook({identifier: urlInfo.hashParts[0], title: urlInfo.hashParts[0].toUpperCase()})
    }
  }, [currentCatalogEntry])

  useEffect(() => {
    const getLanguages = async () => {
      setIsFetching(true)
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/languages?stage=branch&metadataType=rc&metadataType=sb&metadataType=tc`)
      .then(response => {
        return response.json()
      })
      .then(({data}) => {
        setLanguages(data)
      })
      .catch(e => {
        console.log("Error fetching languages:", e)
        setError("Failed to fetch languages")
      })
      .finally(() => {
        setIsFetching(false)
      })
    }

    if (serverInfo && canLoad && !languages) {
      getLanguages()
    }
  }, [serverInfo, canLoad])

  useEffect(() => {
    const fetchOwners = async () => {
      setIsFetching(true)
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/owners?stage=branch&metadataType=rc&metadataType=sb&metadataType=tc&lang=${encodeURIComponent(selectedLanguage.lc)}`)
      .then(response => {
        return response.json()
      })
      .then(({data}) => {
        setOwners({...owners, [selectedLanguage.lc]: data})
      })
      .catch(e => {
        setError("Error fetching providers")
        console.log(`Error fetching owners for language ${language.lc}:`, e)
      })
      .finally(() => {
        setIsFetching(false)
      })
    }

    if (serverInfo && selectedLanguage && !(selectedLanguage.lc in owners) && canLoad) {
      fetchOwners()
    }
  }, [serverInfo, selectedLanguage])

  useEffect(() => {
    const fetchRepos = async () => {
      setIsFetching(true)
      fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/search?metadataType=rc&metadataType=sb&metadataType=tc&lang=${encodeURIComponent(selectedLanguage.lc)}&owner=${encodeURIComponent(selectedOwner.username)}`)
      .then(response => response.json())
      .then(({data}) => {
        setRepos({...repos, [selectedOwner.username]: data})
      })
      .catch(e => {
        setError("Error fetching repositories")
        console.log(`Error fetching repos for ${selectedOwner.username}:`, e)
      })
      .finally(() => {
        setIsFetching(false)
      })
    }

    if (selectedOwner && !(selectedOwner.username in repos) && canLoad) {
      fetchRepos()
    }
  }, [serverInfo, selectedOwner, canLoad])

  useEffect(() => {
    const fetchBranches = async () => {
      setIsFetching(true)
      fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/${selectedRepo.full_name}/branches`)
        .then(response => response.json())
        .then(branches => {
          setAvailableRefs({...availableRefs, [selectedRepo.full_name]: {...availableRefs[selectedRepo.full_name], branch: branches.map(branch => branch.name)}})
        })
        .catch(e => {
          setError("Error fetching branches")
          console.log(`Error fetching branches for ${selectedRepo.full_name}:`, e)
        })
        .finally(() => {
          setIsFetching(false)
        })
    }

    const fetchTags = async () => {
      setIsFetching(true)
      fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/${selectedRepo.full_name}/tags`)
        .then(response => response.json())
        .then(tags => {
          setAvailableRefs({...availableRefs, [selectedRepo.full_name]: {...availableRefs[selectedRepo.full_name], tag: tags.map(tag => tag.name)}})
        })
        .catch(e => {
          setError("Error fetching tags")
          console.log(`Error fetching tags for ${selectedRepo.full_name}:`, e)
        })
        .finally(() => {
          setIsFetching(false)
        })
    }

    if (serverInfo && selectedOwner && selectedRepo && canLoad) {
      if (!(selectedRepo.full_name in availableRefs) || !(refTypeChoice in availableRefs[selectedRepo.full_name])) {
        if (refTypeChoice == "branch") {
          fetchBranches()
        } else if (refTypeChoice == "tag") {
          fetchTags()
        }
      }
    }
  }, [serverInfo, selectedRepo, refTypeChoice, canLoad])

  useEffect(() => {
    const fetchCatalogEntry = async (ref) => {
      setIsFetching(true)
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/entry/${selectedRepo.full_name}/${ref}`)
      .then(response => response.json())
      .then((entry) => {
        setCatalogEntry(entry)
        if (!entry.is_valid) {
          setError("WARNING! This entry has invalid metadata")
        }
      })
      .catch(e => {
        setError("This is an invalid entry")
        console.log(`Error fetching catalog entry for ${selectedRepo.full_path}/${ref}:`, e)
      })
      .finally(() => {
        setIsFetching(false)
      })
    }

    if (selectedRepo && refTypeChoice) {
      if (refTypeChoice == "prod" && selectedRepo.catalog.prod) {
        fetchCatalogEntry(selectedRepo.catalog.prod.branch_or_tag_name)
      } else if (refTypeChoice == "latest" && selectedRepo.catalog.latest) {
        fetchCatalogEntry(selectedRepo.catalog.latest.branch_or_tag_name)
      } else if (selectedRef) {
        fetchCatalogEntry(selectedRef)
      }
    }
  }, [serverInfo, refTypeChoice, selectedRef, canLoad])

  const nodeRef = React.useRef(null);

  const handleSelectResource = (data) => {
    if (selectedRepo) {
      let ref = selectedRef || ""
      if (refTypeChoice == "prod" && selectedRepo.catalog.prod) {
        ref = selectedRepo.catalog.prod.branch_or_tag_name
      } else if (refTypeChoice == "latest" && selectedRepo.catalog.latest) {
        ref = selectedRepo.catalog.latest.branch_or_tag_name
      }
      window.location.href = `/u/${selectedRepo.full_name}/${ref}#${selectedBook.identifier}`
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

  const handleRefTypeChange = event => {
    setSelectedRef()
    setCatalogEntry()
    setError()
    setRefTypeChoice(event.target.value)
  }

  const styles = {
    labelAsterisk: {
      color: "red"
    }
  };

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
          <StyledTextField
            {...params}
            label="Language"
            variant="outlined"
            required
          />
        )}
        isOptionEqualToValue={(option, value) => option.lc === value.lc}
        onChange={
          (event, option) => {
            if (! selectedLanguage || option.lc != selectedLanguage.lc) {
              setSelectedLanguage(option)
              setSelectedOwner()
              setSelectedRepo()
              setSelectedRef()
              setCatalogEntry()
              setSelectedBook()
            }
          }
        }
      /> : ""}
      {selectedLanguage && selectedLanguage.lc in owners ?
      <Autocomplete
        id="owner-select"
        sx={{ width: 300, paddingTop: "5px" }}
        options={owners[selectedLanguage.lc]}
        autoHighlight
        clearOnEscape
        defaultValue={selectedOwner}
        getOptionLabel={option => (option.full_name ? `${option.full_name} (${option.username})` : option.username )}
        renderInput={(params) => (
          <StyledTextField
            {...params}
            label="Provider"
            variant="outlined"
            required
          />
        )}
        isOptionEqualToValue={(option, value) => option.username === value.username}
        onChange={
          (event, option) => {
            if(!selectedOwner || selectedOwner.username != option.username) {
              setSelectedOwner(option)
              setError()
              setSelectedRepo()
              setSelectedRef()
              setCatalogEntry()
              setSelectedBook()
            }
          }
        }
      /> : ""}
      {selectedOwner && selectedOwner.username in repos ?
      <Autocomplete
        id="repo-select"
        sx={{ width: 300, paddingTop: "5px" }}
        options={repos[selectedOwner.username]}
        autoHighlight
        clearOnEscape
        defaultValue={selectedRepo}
        getOptionLabel={option => `${option.name} (${option.subject})`}
        renderInput={(params) => (
          <StyledTextField
            {...params}
            label="Repository"
            variant="outlined"
            required
          />
        )}
        isOptionEqualToValue={(option, value) => option.full_name === value.full_name}
        onChange={
          (event, option) => {
            if(!selectedRepo || selectedRepo.full_name != option.full_name) {
              setSelectedRepo(option)
              setError()
              setSelectedRef()
              setCatalogEntry()
              setSelectedBook()
            }
          }
        }
      /> : ""}
      {selectedRepo ?
      <FormControl>
        <FormLabel id="ref">Select Tag or Branch</FormLabel>
        <RadioGroup
          aria-labelledby="ref-radio-buttons-group-label"
          defaultValue={refTypeChoice}
          name="ref-radio-buttons-group"
          onChange={handleRefTypeChange}
        >
          <div>
            {selectedRepo.catalog.latest ?
              <FormControlLabel
                value="latest"
                control={<Radio />}
                label={"Default Branch ("+selectedRepo.catalog.latest.branch_or_tag_name+")"}
              /> : ""}
            <FormControlLabel value="branch" control={<Radio />} label="Branch" />
          </div>
          <div>
            {selectedRepo.catalog.prod ?
              <FormControlLabel
                value="prod"
                control={<Radio />}
                label={"Latest Release ("+selectedRepo.catalog.prod.branch_or_tag_name+")"}
              /> : ""}
            <FormControlLabel value="tag" control={<Radio />} label="Tag" />
          </div>
        </RadioGroup>
      </FormControl> : ""}
      {selectedRepo && selectedRepo.full_name in availableRefs && refTypeChoice in availableRefs[selectedRepo.full_name] ? 
      <Autocomplete
        id="select-ref"
        sx={{ width: 300, paddingTop: "5px" }}
        defaultValue={selectedRef}
        options={ availableRefs[selectedRepo.full_name][refTypeChoice] }
        onChange={(event, option) => {
          if(!selectedRef || selectedRef != option) {
            setError()
            setSelectedRef(option)
            setCatalogEntry()
            setSelectedBook()
          }
        }}
        renderInput={(params) => <TextField {...params} label={refTypeChoice.charAt(0).toUpperCase() + refTypeChoice.slice(1)} margin="normal" />}
      />: ""}
      {catalogEntry && catalogEntry.ingredients && (catalogEntry.subject == "Bible" || catalogEntry.subject == "Aligned Bible" || catalogEntry.subject.startsWith("TSV ")) ? 
      <Autocomplete
        id="select-book"
        sx={{ width: 300, paddingTop: "5px" }}
        options={catalogEntry.ingredients}
        autoHighlight
        clearOnEscape
        defaultValue={selectedBook}
        getOptionLabel={option => `${option.title || option.identifier.toUpperCase()}${option.title ? ` (${option.identifier.toUpperCase()})`: ''}`}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Book"
            variant="outlined"
          />
        )}
        isOptionEqualToValue={(option, value) => option.identifier === value.identifier}
        onChange={
          (event, option) => {
            if(!selectedBook || selectedBook.identifer != option.identifier) {
              setSelectedBook(option)
            }
          }
        }
      /> : ""}        
      {error ? 
      <Typography id="modal-error" sx={{textAlign: "center", color: "red"}}>
        {error}
      </Typography>
      : isFetching ? 
      <Typography id="modal-modal-title" variant="h6" component="h2" sx={{textAlign: "center"}}>
        <CircularProgress />
      </Typography>
      : ""}
    </DialogContent>
    <DialogActions>
      <Button autoFocus onClick={()=>setShowModal(false)}>
        Cancel
      </Button>
      <Button onClick={handleSelectResource} disabled={!selectedRepo}>Select</Button>
    </DialogActions>
  </Dialog>
  )
}
