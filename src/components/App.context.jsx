import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { DCS_SERVERS, API_PATH } from "../common/constants";
import { RepositoryApi, OrganizationApi } from 'dcs-js';
import RcBible from './RcBible'
import RcOpenBibleStories from './RcOpenBibleStories'

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
  const [resourceComponent, setResourceComponent] = useState()
  const [repoClient, setRepoClient] = useState(null)
  const [organizationClient, setOrganizationClient] = useState(null)
  const [organizations, setOrganizations] = useState()
  const [branches,setBranches] = useState()
  const [tags,setTags] = useState()
  const [repos,setRepos] = useState()
  const [languages,setLanguages] = useState()
  const [printHtml, setPrintHtml] = useState("")
  const [canChangeColumns, setCanChangeColumns] = useState(false)

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
    const info = {
      owner: urlParts[0] || "unfoldingWord",
      repo: urlParts[1] || "en_ult",
      ref: urlParts[2] || "master",
      extraPath: urlParts.slice(3),
    }
    setUrlInfo(info)
  }, [])

  useEffect(() => {
    if (serverInfo?.baseUrl) {
      const config = { basePath: `${serverInfo.baseUrl}/${API_PATH}` }
      setRepoClient(new RepositoryApi(config))
      setOrganizationClient(new OrganizationApi(config))
    }
  }, [serverInfo?.baseUrl])

  useEffect(() => {
    if (urlInfo) {
      const params = new URLSearchParams(window.location.search)
      window.history.replaceState({id: "100"}, '', decodeURIComponent(`/u/${urlInfo.owner}/${urlInfo.repo}/${urlInfo.ref}/${urlInfo.extraPath.join("/")}${params.size ? `?${params}` : ''}`))
    }
  }, [urlInfo])

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/${urlInfo.owner}/${urlInfo.repo}`)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error("Repo not found")
        }
      })
      .then(data => {
        console.log("DATA", data)
        setRepo(data)
        if (urlInfo.ref == "master" && data.default_branch != "master") {
          setUrlInfo({...urlInfo, ref: data.default_branch})
        }
      }).catch(() => {
        setErrorMessage("Repo not found")
      })
    }

    if (!repo && urlInfo && serverInfo?.baseUrl) {
      fetchCatalogEntry().catch(setErrorMessage);
    }
  }, [urlInfo, serverInfo?.baseUrl, repo]);

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/entry/${repo?.owner.username}/${repo.name}/${urlInfo.ref}`)
      .then(response => {
        return response.json();
      })
      .then(data => {
        setCatalogEntry(data)
      }).catch(() => {
        setErrorMessage("Metadata not found")
      })
    }

    if (!catalogEntry && repo && urlInfo) {
      fetchCatalogEntry().catch(setErrorMessage);
    }
  }, [urlInfo, serverInfo?.baseUrl, repo, catalogEntry]);

  useEffect(() => {
    if (catalogEntry && ! resourceComponent) {
      if(catalogEntry?.metadata_type && catalogEntry?.subject) {
        switch (catalogEntry.metadata_type) {
          case "rc": 
            switch (catalogEntry.subject) {
              case "Aligned Bible":
              case "Bible":
              case "Greek New Testament":
              case "Hebrew Old Testament":
                setResourceComponent(<RcBible />)
                break
              case "Open Bible Stories":
                setResourceComponent(<RcOpenBibleStories />)
                break
              default:
                setErrorMessage(`Subject \`${catalogEntry.subject}\` is currently not supported.`)
            }
            break
          case "sb":
            setErrorMessage("Scripture Burrito repositories are currently not supported.")
            break
          case "ts":
            setErrorMessage("translationStudio repositories are currently not supported.")
            break
          case "tc":
            setErrorMessage("translationCore repositories are currently not supported.")
            break
          default:
            setErrorMessage(`Metadata type \`${catalogEntry.metadata_type}\` not supported.`)
        }
      } else {
        setErrorMessage("Not a valid repository that we can convert")
      }
    }
  }, [catalogEntry, resourceComponent])

  useEffect(() => {
    const getBranches = async () => {
      const _branches = await repoClient.repoListBranches({owner: repo.owner.username, repo: repo.name}).then(({data}) => data).catch(console.error)
      if (_branches?.length)
        setBranches(_branches.map(branch => {return {label: branch.name, value: branch}}))
      else
        setBranches(null)
    }
    if (!branches && repo) { 
        getBranches()
    }

  }, [repoClient, repo, branches]);

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

    if (!languages && serverInfo?.baseUrl) {
      getLanguages()
    }
  }, [serverInfo?.baseUrl, languages]);

  useEffect(() => {
    const getRepos = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/search?owner=${urlInfo?.owner}&lang=en&metadataType=rc`)
      .then(response => {
        return response.json();
      })
      .then(({data}) => {
        setRepos(data)
      }).catch(() => {
        setErrorMessage("No repositories found")
      })
    }

    if (!repos && serverInfo?.baseUrl) {
      getRepos()
    }
  }, [repos, urlInfo?.owner, serverInfo?.baseUrl]);

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
    if ( organizationClient && !organizations) {
      getOrgs().catch(console.error)
    }

  }, [organizationClient, organizations])

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
      resourceComponent,
      printHtml,
      canChangeColumns,
      buildInfo,
      serverInfo
    },
    actions: {
      setUrlInfo,
      setErrorMessage,
      setPrintHtml,
      setCanChangeColumns,
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
