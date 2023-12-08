import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { DCS_SERVERS, API_PATH } from "../common/constants";
import { RepositoryApi, OrganizationApi } from 'dcs-js';
import RcBible from './RcBible'
import RcOpenBibleStories from './RcOpenBibleStories'
import RcTranslationNotes from './RcTranslationNotes'
import { updateUrlHotlink } from "../utils/url";

// const ComponentMap = {
//   rc: {
//     "Bible": RcBible,
//     "Open Bible Stories": RcOpenBibleStories,
//   },
// }

export const AppContext = React.createContext();

export function AppContextProvider({ children }) {
  const [errorMessage, setErrorMessage] = useState()
  const [urlInfo, setUrlInfo] = useState()
  const [serverInfo, setServerInfo] = useState()
  const [buildInfo, setBuildInfo] = useState()
  const [repo, setRepo] = useState()
  const [catalogEntry, setCatalogEntry] = useState()
  const [ResourceComponent, setResourceComponent] = useState()
  const [repoClient, setRepoClient] = useState(null)
  const [organizationClient, setOrganizationClient] = useState(null)
  const [organizations, setOrganizations] = useState()
  const [branches,setBranches] = useState()
  const [tags,setTags] = useState()
  const [repos,setRepos] = useState()
  const [languages,setLanguages] = useState()
  const [printHtml, setPrintHtml] = useState("")
  const [canChangeColumns, setCanChangeColumns] = useState(false)
  const [loadingMainContent, setLoadingMainContent] = useState(true)

  useEffect(() => {
    const url = (new URL(window.location.href))
    const server = url.searchParams.get("server")?.toLowerCase()
    if (server) {
      if (server in DCS_SERVERS) {
        setServerInfo(DCS_SERVERS[server.toLowerCase()])
      } else {
        let baseUrl = server
        if (! server.startsWith("http")) {
          baseUrl = `http${server.includes("door43.org") ? "s" : ""}://${server}`
        }
        setServerInfo({baseUrl, ID: server})
      }
    } else if (url.hostname == 'preview.door43.org') {
      setServerInfo(DCS_SERVERS['prod'])
    } else {
      setServerInfo(DCS_SERVERS['qa'])
    }

    const urlParts = url.pathname.replace(/^\/u(\/|$)/, "").replace(/\/+$/, "").split("/")
    const ref = url.searchParams.get("ref")?.toLowerCase() || "master"
    const info = {
      owner: urlParts[0] || "unfoldingWord",
      repo: urlParts[1] || "en_ult",
      ref: ref || "master",
      extraPath: urlParts.slice(2),
    }
    console.log(info)
    setUrlInfo(info)
    updateUrlHotlink(info)
  }, [])

  useEffect(() => {
    if (serverInfo?.baseUrl) {
      const config = { basePath: `${serverInfo.baseUrl}/${API_PATH}` }
      setRepoClient(new RepositoryApi(config))
      setOrganizationClient(new OrganizationApi(config))
    }
  }, [serverInfo?.baseUrl])

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/${urlInfo.owner}/${urlInfo.repo}`)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error(`Repository not found: ${urlInfo.owner}/${urlInfo.repo}`)
        }
      })
      .then(data => {
        setRepo(data)
        if (urlInfo.ref == "master" && data.default_branch != "master") {
          const _urlInfo = {...urlInfo, ref: data.default_branch}
          setUrlInfo(_urlInfo)
          updateUrlHotlink(_urlInfo)
        }
      }).catch(err => {
        setErrorMessage(err.message)
      })
    }

    if (!repo && urlInfo && serverInfo?.baseUrl) {
      fetchCatalogEntry().catch(setErrorMessage);
    }
  }, [urlInfo, serverInfo?.baseUrl, repo]);

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/entry/${repo?.full_name}/${urlInfo.ref}`)
      .then(response => {
        if (response.ok) {
          return response.json()
        } else {
          throw new Error(`No metadata found for ${repo.full_name}, ref "${urlInfo.ref}". Please verify this is a valid resource and a valid ref.`)
        }
      })
      .then(data => {
        setCatalogEntry(data)
      }).catch(err => {
        setErrorMessage(err.message)
      })
    }

    if (!catalogEntry && repo && urlInfo) {
      fetchCatalogEntry().catch(setErrorMessage);
    }
  }, [urlInfo, serverInfo?.baseUrl, repo, catalogEntry]);

  useEffect(() => {
    if (catalogEntry && ! ResourceComponent) {
      if(catalogEntry?.metadata_type && catalogEntry?.subject) {
        const props = {
          urlInfo,
          serverInfo,
          catalogEntry,
          setPrintHtml,
          setErrorMessage,
          setCanChangeColumns,
          updateUrlHotlink,
        }
        switch (catalogEntry.metadata_type) {
          case "rc":
            switch (catalogEntry.subject) {
              case "Aligned Bible":
              case "Bible":
              case "Greek New Testament":
              case "Hebrew Old Testament":
                setResourceComponent(<RcBible {...props} />)
                return
              case "Open Bible Stories":
                setResourceComponent(<RcOpenBibleStories {...props} />)
                return
              case "TSV Translation Notes":
                setResourceComponent(<RcTranslationNotes {...props} />)
                return
              default:
                setErrorMessage(`Conversion of \`${catalogEntry.subject}\` resources is currently not supported.`)
            }
            return
          case "sb":
            setErrorMessage("Conversion of Scripture Burrito repositories is currently not supported.")
            return
          case "ts":
            setErrorMessage("Conversion of translationStudio repositories is currently not supported.")
            return
          case "tc":
            setErrorMessage("Conversion of translationCore repositories is currently not supported.")
            return
        }
      }
      setErrorMessage("Not a valid repository that can be convert.")
    }
  }, [catalogEntry, ResourceComponent])

  useEffect(() => {
    const getBranches = async () => {
      const _branches = await repoClient.repoListBranches({owner: repo.owner.username, repo: repo.name}).then(({data}) => data).catch(console.error)
      if (_branches?.length)
        setBranches(_branches.map(branch => {return {label: branch.name, value: branch}}))
      else
        setBranches(null)
    }
    if (!loadingMainContent && !branches && repo) {
        getBranches()
    }

  }, [loadingMainContent, repoClient, repo, branches]);

  useEffect(() => {
    const getTags = async () => {
      const _tags = await repoClient.repoListTags({owner: repo.owner.username, repo: repo.name}).then(({data}) => data).catch(console.error)
      if (_tags?.length)
        setTags(_tags.map(tag => {return {label: tag.name, value: tag}}))
      else
        setTags(null)

    }
    if (!tags && repo) {
      getTags()
    }
  }, [tags, repoClient, repo]);

  useEffect(() => {
    const getLanguages = async () => {
      fetch(`${serverInfo?.baseUrl}/${API_PATH}/catalog/list/languages?stage=latest&metadataType=rc`)
      .then(response => {
        return response.json();
      })
      .then(({data}) => {
        setLanguages(data)
      }).catch(() => {
        setErrorMessage("No languages found")
      })
    }

    if (!loadingMainContent && !languages && serverInfo?.baseUrl) {
      getLanguages()
    }
  }, [serverInfo?.baseUrl, loadingMainContent, languages]);

  useEffect(() => {
    const getRepos = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/search?owner=${repo.owner.username}&lang=en&metadataType=rc`)
      .then(response => {
        return response.json();
      })
      .then(({data}) => {
        setRepos(data)
      }).catch(() => {
        setErrorMessage("No repositories found")
      })
    }

    if (!loadingMainContent && !repos && serverInfo?.baseUr && repo) {
      getRepos()
    }
  }, [repos, repo, loadingMainContent, serverInfo?.baseUrl]);

  useEffect(() => {
    const bibleSubjects = [
      'Aligned Bible',
      'Bible',
      'Hebrew Old Testament',
      'Greek New Testament',
      'Open Bible Stories',
    ]

    const getOrgs = async() => {
      const response  = await organizationClient.orgGetAll()
      if (response.status === 200) {
        const orgs = response?.data.filter((org) => org.repo_subjects && org?.repo_subjects.some((subject) => bibleSubjects?.includes(subject))).map(org => org.username)
        setOrganizations(orgs)
      }
    }
    if ( ! loadingMainContent && organizationClient && !organizations) {
      getOrgs().catch(console.error)
    }

  }, [loadingMainContent, organizationClient, organizations])

  useEffect(() => {
    if (printHtml || errorMessage) {
      setLoadingMainContent(false)
    }
  }, [printHtml, errorMessage])

  // create the value for the context provider
  const context = {
    state: {
      urlInfo,
      catalogEntry,
      errorMessage,
      organizations,
      branches,
      tags,
      repo,
      repos,
      languages,
      resourceComponent: ResourceComponent,
      printHtml,
      canChangeColumns,
      buildInfo,
      serverInfo,
      loadingMainContent,
    },
    actions: {
      setUrlInfo,
      setErrorMessage,
      setPrintHtml,
      setCanChangeColumns,
      setLoadingMainContent,
    },
  }

  return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}

AppContextProvider.propTypes = {
  /** Children to render inside of Provider */
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]).isRequired,
};
