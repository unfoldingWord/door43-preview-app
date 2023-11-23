import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
// import Bible from "./Bible";
import { BASE_DCS_URL, BASE_QA_URL, API_PATH } from "../common/constants";
import { RepositoryApi, OrganizationApi } from 'dcs-js';
import { decodeBase64ToUtf8 } from '../utils/base64Decode'

export const AppContext = React.createContext();

export function AppContextProvider({ children }) {
  const [errorMessage, setErrorMessage] = useState()
  const [urlInfo, setUrlInfo] = useState()
  const [catalogEntry, setCatalogEntry] = useState()
  const [bibleRef, setBibleRef] = useState()
  const [repoClient, setRepoClient] = useState(null)
  const [organizationClient, setOrganizationClient] = useState(null)
  const [organizations, setOrganizations] = useState()
  const [branches,setBranches] = useState()
  const [tags,setTags] = useState()
  const [repos,setRepos] = useState()
  const [languages,setLanguages] = useState()
  const [loading, setLoading] = useState(true)
  const [usfmText, setUsfmText] = useState()
  const [usfmFileLoaded, setUsfmFileLoaded] = useState(false)
 
  useEffect(() => {
    const urlParts = (new URL(window.location.href)).pathname.replace(/^\/u\//, "").split("/")
    const info = {
      owner: urlParts[0] || "unfoldingWord",
      repo: urlParts[1] || "en_ult",
      ref: urlParts[2] || "master",
    }
    const br = {
      book: urlParts[3] || "mat",
      chapter: urlParts[4] || "1",
      verse: urlParts[5] || "1",
    }
    window.history.pushState({id: "100"}, "Page", `/u/${info.owner}/${info.repo}/${info.ref}/${br.book}/${br.chapter !== "1" || br.verse !== "1"?`${br.chapter}/${br.verse}/`: ""}`);
    setUrlInfo(info)
    setBibleRef(br)
    const config = { basePath: `${BASE_QA_URL}/${API_PATH}/` }
    setRepoClient(new RepositoryApi(config))
    setOrganizationClient(new OrganizationApi(config))
  }, [])

  useEffect(() => {
    const handleInitialLoad = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          const text = await response.text();
          throw Error(text);
        }
        
        const jsonResponse = await response.json();
        if (jsonResponse?.content) {
          const _usfmText = decodeBase64ToUtf8(jsonResponse.content)
          setUsfmText(_usfmText)
          setUsfmFileLoaded(true)
        }
        setLoading(false)
          
      } catch (error) {
        console.log(error);
        setErrorMessage(error?.message)
        setLoading(false)
      }      
    }

    const loadFile = async () => {
      let filePath = null
      for(let i = 0; i < catalogEntry.ingredients.length; ++i) {
        const ingredient = catalogEntry.ingredients[i]
        if (ingredient.identifier == bibleRef?.book) {
          filePath = ingredient.path
          break
        }
      }
      if (! filePath) {
        setErrorMessage("Book not supported")
        setLoading(false)
      } else {
        const fileURL = `${BASE_DCS_URL}/${API_PATH}/repos/${catalogEntry.owner}/${catalogEntry.repo.name}/contents/${filePath}?ref=${catalogEntry.commit_sha}`
        handleInitialLoad(fileURL)
      }
    }

    if (catalogEntry) {
      loadFile()
    }
  }, [bibleRef?.book, catalogEntry, setErrorMessage]);

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      fetch(`${BASE_DCS_URL}/${API_PATH}/catalog/entry/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref}`)
      .then(response => {
        return response.json();
      })
      .then(data => {
        console.log(data)
        setCatalogEntry(data)
      }).catch(() => {
        setErrorMessage("Not found")
      })
    }

    if (!catalogEntry && urlInfo) {
      fetchCatalogEntry().catch(setErrorMessage);
    }
  }, [urlInfo, catalogEntry]);

  useEffect(() => {
    const getBranches = async () => {
      const _branches = await repoClient.repoListBranches({owner: urlInfo?.owner, repo: urlInfo?.repo}).then(({data}) => data).catch(console.error)
      if (_branches?.length)
        setBranches(_branches.map(branch => {return {label: branch.name, value: branch}}))
      else
        setBranches(null)
    }
    if (!loading && !branches && urlInfo?.owner && urlInfo?.repo) { 
        getBranches()
    }

  }, [tags, repoClient, urlInfo?.owner, urlInfo?.repo, branches, loading]);

  useEffect(() => {
    const getTags = async () => {
      const _tags = await repoClient.repoListTags({owner: urlInfo?.owner, repo: urlInfo?.repo}).then(({data}) => data).catch(console.error)
      if (_tags?.length)
        setTags(_tags.map(tag => {return {label: tag.name, value: tag}}))
      else
        setTags(null)

    }
    if (!loading && !tags && urlInfo?.owner && urlInfo?.repo) {
      getTags()
    }

  }, [tags, repoClient, urlInfo?.owner, urlInfo?.repo, loading]);
  
  useEffect(() => {
    const getLanguages = async () => {
      fetch(`${BASE_DCS_URL}/${API_PATH}/catalog/list/languages?stage=latest&metadataType=rc`)
      .then(response => {
        return response.json();
      })
      .then(({data}) => {
        setLanguages(data)
      }).catch(() => {
        setErrorMessage("No languages found")
      })
    }

    if (!loading && !languages) {
      getLanguages()
    }
  }, [languages, loading]);

  useEffect(() => {
    const getRepos = async () => {
      fetch(`${BASE_DCS_URL}/${API_PATH}/repos/search?owner=${urlInfo?.owner}&lang=en&metadataType=rc`)
      .then(response => {
        return response.json();
      })
      .then(({data}) => {
        setRepos(data)
      }).catch(() => {
        setErrorMessage("No repositories found")
      })
    }

    if (!loading && !repos) {
      getRepos()
    }
  }, [repos, loading, urlInfo?.owner]);

  useEffect(() => {
    const bibleSubjects = [
      'Aligned Bible',
      'Bible',
      'Hebrew Old Testament',
      'Greek New Testament'
    ]
  
    const getOrgs = async() => {
      const response  = await organizationClient.orgGetAll()
      if (response.status === 200) {
        const orgs = response?.data.filter((org) => org.repo_subjects && org?.repo_subjects.some((subject) => bibleSubjects?.includes(subject))).map(org => org.username)
        setOrganizations(orgs)
      }
    }
    if ( organizationClient && !loading && !organizations) {
      getOrgs().catch(console.error)
    }

  }, [loading, organizationClient, organizations])


  // create the value for the context provider
  const context = {
    state: {
      urlInfo,
      catalogEntry,
      bibleRef,
      errorMessage,
      organizations,
      branches,
      tags,
      repos,
      languages,
      loading, 
      usfmText, 
      usfmFileLoaded,
    },
    actions: {
      setErrorMessage,
    },
  };

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}

AppContextProvider.propTypes = {
  /** Children to render inside of Provider */
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
};
