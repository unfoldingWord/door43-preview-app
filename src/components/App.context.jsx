import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { DCS_SERVERS, API_PATH } from "../common/constants";
import RcBible from '../libs/rcBible/components/RcBible'
import RcOpenBibleStories from '../libs/rcOpenBibleStories/components/RcOpenBibleStories'
import RcTranslationNotes from '../libs/rcTranslationNotes/components/RcTranslationNotes'
import { getZipFileDataForCatalogEntry } from "../libs/core/lib/zip";
import { updateUrlHashLink } from "../utils/url";


export const AppContext = React.createContext();

export function AppContextProvider({ children }) {
  const [statusMessage, setStatusMessage] = useState("Preparing Preview. Please wait...")
  const [errorMessage, setErrorMessage] = useState()
  const [urlInfo, setUrlInfo] = useState()
  const [serverInfo, setServerInfo] = useState()
  const [buildInfo, setBuildInfo] = useState()
  const [repo, setRepo] = useState()
  const [catalogEntry, setCatalogEntry] = useState()
  const [zipFileData, setZipFileData] = useState()
  const [ResourceComponent, setResourceComponent] = useState()
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

    const getServerInfo = async () => {
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
      } else if (url.hostname.match(/^(git|preview)\.door43\.org/)) {
        setServerInfo(DCS_SERVERS['prod'])
      } else if (url.hostname == "develop.door43.org" ) {
        setServerInfo(DCS_SERVERS['dev'])
      } else {
        setServerInfo(DCS_SERVERS['qa'])
      }
    }

    const getUrlInfo = async () => {
      const urlParts = url.pathname.replace(/^\/(u\/){0,1}/, "").replace(/\/+$/, "").split("/")
      // if(urlParts.length < 2) {
      //   throw new Error("Home Page (under construction)")
      // }
      const info = {
        owner: urlParts[0] || "",
        repo: urlParts[1] || "",
        ref: urlParts[2] == "preview" ? urlParts.slice(3).join('/') : urlParts.slice(2).join('/'),
        hashParts: url.hash ? url.hash.replace('#', '').split('-') : [],
      }
      setUrlInfo(info)
    }

    getServerInfo().catch(e => setErrorMessage(e?.message))
    getUrlInfo().catch(e => setErrorMessage(e?.message))
  }, [])

  useEffect(() => {
    const fetchRepo = async () => {
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
      }).catch(err => {
        setErrorMessage(err.message)
      })
    }

    if (serverInfo && urlInfo) {
      fetchRepo().catch(e => setErrorMessage(e?.message))
    }
  }, [serverInfo, urlInfo]);

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/entry/${repo?.full_name}/${urlInfo.ref || repo.default_branch}`)
      .then(response => {
        if (response.ok) {
          return response.json()
        } else {
          throw new Error(`No metadata found for ${repo.full_name}, ref "${urlInfo.ref || repo.default_branch}". Please verify this is a valid resource and a valid ref.`)
        }
      })
      .then(data => {
        setCatalogEntry(data)
      }).catch(err => {
        setErrorMessage(err.message)
      })
    }

    if (repo) {
      fetchCatalogEntry().catch(e => setErrorMessage(e?.message))
    }
  }, [repo])

  useEffect(() => {
    const loadZipFileData = async () => {
      try {
        getZipFileDataForCatalogEntry(catalogEntry)
        .then(zip => setZipFileData(zip))
      } catch (error) {
        setErrorMessage(error?.message)
      }
    }

    if (catalogEntry) {
        loadZipFileData()
    }
  }, [catalogEntry])

  useEffect(() => {
    if (catalogEntry && zipFileData) {
      if(catalogEntry?.metadata_type && catalogEntry?.subject) {
        const props = {
          urlInfo,
          serverInfo,
          catalogEntry,
          zipFileData,
          setPrintHtml,
          setStatusMessage,
          setErrorMessage,
          setCanChangeColumns,
          updateUrlHashLink,
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
  }, [catalogEntry, zipFileData])

  // useEffect(() => {
  //   const getBranches = async () => {
  //     fetch(`${serverInfo?.baseUrl}/${API_PATH}/repos/${repo.full_name}/branches`)
  //     .then(response => {
  //       return response.json()
  //     })
  //     .then(_branches => {
  //       setTags(_branches.map(branch => {return {label: branch.name, value: branch}}))
  //     }).catch(e => {
  //       console.log(`Error fetching repo's branches: ${repo.full_name}`)
  //       console.log(e)
  //     })
  //   }

  //   if (!loadingMainContent && repo) {
  //       getBranches()
  //   }
  // }, [loadingMainContent, repo]);

  // useEffect(() => {
  //   const getTags = async () => {
  //     fetch(`${serverInfo?.baseUrl}/${API_PATH}/repos/${repo.full_name}/tags`)
  //     .then(response => {
  //       return response.json()
  //     })
  //     .then(_tags => {
  //       setTags(_tags.map(tag => {return {label: tag.name, value: tag}}))
  //     }).catch(e => {
  //       console.log(`Error fetching repo's tags: ${repo.full_name}`)
  //       console.log(e)
  //     })
  //   }

  //   if (! loadingMainContent && repo) {
  //     getTags()
  //   }
  // }, [loadingMainContent, repo]);

  // useEffect(() => {
  //   const getLanguages = async () => {
  //     fetch(`${serverInfo?.baseUrl}/${API_PATH}/catalog/list/languages?stage=latest&metadataType=rc`)
  //     .then(response => {
  //       return response.json()
  //     })
  //     .then(({data}) => {
  //       setLanguages(data)
  //     }).catch(() => {
  //       console.log("No languages found")
  //       // setErrorMessage("No languages found")
  //     })
  //   }

  //   if (!loadingMainContent && !languages) {
  //     getLanguages()
  //   }
  // }, [loadingMainContent]);

  // useEffect(() => {
  //   const getRepos = async () => {
  //     fetch(`${serverInfo.baseUrl}/${API_PATH}/repos/search?owner=${repo.owner.username}&lang=en&metadataType=rc`)
  //     .then(response => {
  //       return response.json();
  //     })
  //     .then(({data}) => {
  //       setRepos(data)
  //     }).catch(() => {
  //       console.log("No repositories found")
  //       // setErrorMessage("No repositories found")
  //     })
  //   }

  //   if (!loadingMainContent && repo) {
  //     getRepos()
  //   }
  // }, [loadingMainContent, repo]);

  // useEffect(() => {
  //   const bibleSubjects = [
  //     'Aligned Bible',
  //     'Bible',
  //     'Hebrew Old Testament',
  //     'Greek New Testament',
  //     'Open Bible Stories',
  //   ]

  //   const getOrgs = async() => {
  //     // fetch(`${serverInfo?.baseUrl}/${API_PATH}/catalog/list/owners?stage=latest`)
  //     fetch(`${serverInfo?.baseUrl}/${API_PATH}/orgs?subject=Open%20Bible%20Stories&subject=Bible&subject=Aligned%20Bible&subject=TSV%20Translation%20Notes&subject=TSV%20Translation%20Questions&subject=Translation%20Words&subject=Translation%20Academy&subject=TSV%20Translation%20Words%20Links`)
  //     .then(response => {
  //       return response.json()
  //     })
  //     .then(_orgs => {
  //       setOrganizations(_orgs.map(org => org.username))
  //     }).catch(e => {
  //       console.log(`Error fetching orgs`)
  //       console.log(e)
  //     })
  //   }

  //   if (! loadingMainContent && !organizations) {
  //     getOrgs().catch(console.error)
  //   }
  // }, [loadingMainContent, organizations])

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
      zipFileData,
      statusMessage,
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
      setStatusMessage,
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
