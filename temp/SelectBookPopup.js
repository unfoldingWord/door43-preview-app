import React, { useState, useEffect } from 'react'

import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import Autocomplete from '@mui/material/Autocomplete'

import { bookSelectList } from '@common/BooksOfTheBible'

export default function SelectBookPopup(
{
  onNext,
  showModal,
  setShowModal,
}) {

  const [repository, setRepository] = useState(null)
  const [catalogProd, setCatalogProd] = useState(null)
  const [catalogLatest, setCatalogLatest] = useState(null)
  const [refTypeChoice, setRefTypeChoice] = useState('')
  const [availableRefs, setAvailableRefs] = useState(null)
  const [selectedRef, setSelectedRef] = useState(null)

  const handleRefTypeChange = event => {
    console.log(event.target.value)
    setSelectedRef('')
    setRefTypeChoice(event.target.value)
  }

  useEffect( () => {
    console.log("usfmSource=", usfmSource)
    if ( usfmSource === 'dcs' ) {

      if ( selectedRef === null ) {
        setAddDisabled(true)
        return
      }

      // all inputs are present, make the button active
  const handleOrgChange = event => {
    setRepos([])
    setSelectedOrganization(event.target.value)
  }

  const handleClickNext = () => {
    onNext({pushAccess, usfmData, uploadedFilename, usfmSource, selectedBook, url, languageId, repository: selectedRepository, owner: selectedOrganization, ref: selectedRef})
    handleClickClose()
    setUrl('')
  }

  useEffect(() => {
    async function getRepos() {
      setLoading(true)
      const response = await repoClient.repoSearch({owner: selectedOrganization, subject:bibleSubjects.join(',')})
      if ( 200 === response.status ) {
        setRepos( response.data.data )
      }
      setLoading(false)
    }
    if ( repoClient && selectedOrganization) {
      getRepos().catch(console.error)
    } else {
      setRepos([])
    }
  }, [repoClient, selectedOrganization])

  const handleRepositoryChange = event => {
    setSelectedRepository(event.target.value)
  }

  useEffect(() => {
    if (selectedOrganization && selectedRepository) {
      console.log("repos size: ", repos.length, selectedOrganization, selectedRepository)
      console.log(repos)
      const repo = repos.find((repo) => repo.name === selectedRepository && repo.owner.username == selectedOrganization)
      console.log("REPO", repo)
      setAvailableRefs(null)
      if (repo) {
        setRepository(repo)
        setLanguageId(repo.language)
        setAvailableBooks(repo.ingredients.map(ingredient => ingredient.identifier))
        if (repo.catalog ) {
          setCatalogProd(repo.catalog.prod)
          setCatalogLatest(repo.catalog.latest)
        } else {
          setCatalogProd(null)
          setCatalogLatest(null)
        }
        setPushAccess(repo?.permissions?.push)
      } else {
        setRepository(null)
        setLanguageId(null)
        setAvailableBooks(null)
        setCatalogProd(null)
        setCatalogLatest(null)
        setPushAccess(false)
      }
    }
  }, [selectedRepository, selectedOrganization])

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
  }, [selectedRepository, selectedOrganization, refTypeChoice, repoClient])

  const handleFileUpload = (e ) => {
    if (!e.target.files) {
      return;
    }

        {repository ?
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
              {catalogProd?<FormControlLabel value="prod" control={<Radio />} label={"Latest Release ("+catalogProd.branch_or_tag_name+")"} />:""}
            <FormControlLabel value="tag" control={<Radio />} label="Tag" />
            </div>
            <div>
              {catalogLatest?<FormControlLabel value="latest" control={<Radio />} label={"Default Branch ("+catalogLatest.branch_or_tag_name+")"} />:""}
            <FormControlLabel value="branch" control={<Radio />} label="Branch" />
            </div>
          </RadioGroup>
        </FormControl>: ""}
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
  }
}

