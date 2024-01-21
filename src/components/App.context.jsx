import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { DCS_SERVERS, API_PATH } from '@common/constants'
import { updateUrlHashInAddressBar } from '@utils/url'
import { getCatalogEntry } from '@libs/core/lib/dcsApi'

// Converter components
import Bible from '@libs/Bible/components/Bible'
import OpenBibleStories from '@libs/openBibleStories/components/OpenBibleStories'
import RcTranslationNotes from '@libs/rcTranslationNotes/components/RcTranslationNotes'


export const AppContext = React.createContext();

export function AppContextProvider({ children }) {
  const [statusMessage, setStatusMessage] = useState(<>Preparing Preview.<br/>Please wait...</>)
  const [errorMessages, setErrorMessages] = useState([])
  const [urlInfo, setUrlInfo] = useState()
  const [serverInfo, setServerInfo] = useState()
  const [buildInfo, setBuildInfo] = useState()
  const [repo, setRepo] = useState()
  const [catalogEntry, setCatalogEntry] = useState()
  const [ResourceComponent, setResourceComponent] = useState()
  const [organizations, setOrganizations] = useState()
  const [branches,setBranches] = useState()
  const [tags,setTags] = useState()
  const [repos,setRepos] = useState()
  const [languages,setLanguages] = useState()
  const [printHtml, setPrintHtml] = useState("")
  const [canChangeColumns, setCanChangeColumns] = useState(false)
  const [isOpenPrint, setIsOpenPrint] = useState(false)

  const onPrintClick = () => {
    setIsOpenPrint(true)
  }

  const setErrorMessage = (message) => {
    if (! errorMessages.includes(message)) {
      setErrorMessages([...errorMessages, message])
    }
  }

  const clearErrorMessage = idxToRemove => {
    if (errorMessages.length > idxToRemove) {
      errorMessages.splice(idxToRemove, 1)
      setErrorMessages(errorMessages.map((value, idx) => idx != idxToRemove))
    }
  }

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
      const urlParts = url.pathname.replace(/^\/(u\/){0,1}/, "").replace(/\/+$/, "").replace(/preview\/(tag|branch)/, "").split("/")
      if(urlParts.length < 2) {
        throw new Error("Home Page (under construction)")
      }
      const info = {
        owner: urlParts[0] || "",
        repo: urlParts[1] || "",
        ref: urlParts[2] == "preview" ? urlParts.slice(3).join('/') : urlParts.slice(2).join('/'),
        hashParts: url.hash ? url.hash.replace('#', '').split('-') : [],
      }
      setUrlInfo(info)
    }

    getServerInfo().catch(e => setErrorMessage(e.message))
    getUrlInfo().catch(e => setErrorMessage(e.message))
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
      fetchRepo().catch(e => setErrorMessage(e.message))
    }
  }, [serverInfo, urlInfo]);

  useEffect(() => {
    const fetchCatalogEntry = async () => {
      getCatalogEntry(`${serverInfo.baseUrl}/${API_PATH}/catalog`, repo.owner.username, repo.name, urlInfo.ref || repo.default_branch).
      then(entry => setCatalogEntry(entry)).
      catch(err => setErrorMessage(err.message))
    }

    if (repo) {
      fetchCatalogEntry().catch(e => setErrorMessage(e.message))
    }
  }, [repo])

  useEffect(() => {
    if (catalogEntry) {
      if(!catalogEntry.subject || !catalogEntry.ingredients || !catalogEntry.metadata_type)  {
        if (catalogEntry.repo?.ingredients && catalogEntry.repo?.subject && catalogEntry.repo?.metadata_type) {
          catalogEntry.subject = catalogEntry.repo.subject
          catalogEntry.ingredients = catalogEntry.repo.ingredients
          catalogEntry.metadata_type = catalogEntry.repo.metadata_type
          catalogEntry.flavor_type = catalogEntry.repo.flavor_type
          catalogEntry.flavor = catalogEntry.repo.flavor
        } else {
          setErrorMessage(`This references an invalid ${catalogEntry.ref_type ? catalogEntry.ref_type : "entry"}. Unable to determine its type and/or ingredients.`)
          return
        }
      }
      if(catalogEntry.metadata_type && catalogEntry.subject) {
        const props = {
          urlInfo,
          serverInfo,
          catalogEntry,
          setPrintHtml,
          setStatusMessage,
          setErrorMessage,
          setCanChangeColumns,
          updateUrlHashInAddressBar,
          onPrintClick,
        }
        switch (catalogEntry.metadata_type) {
          case "rc":
            switch (catalogEntry.subject) {
              case "Aligned Bible":
              case "Bible":
              case "Greek New Testament":
              case "Hebrew Old Testament":
                setResourceComponent(<Bible {...props} />)
                return
              case "Open Bible Stories":
                setResourceComponent(<OpenBibleStories {...props} />)
                return
              case "Translation Academy":
                setResourceComponent(<RcTranslationAcademy {...props} />)
                return
              case "TSV Translation Notes":
                setResourceComponent(<RcTranslationNotes {...props} />)
                return
              case "TSV Translation Questions":
                setResourceComponent(<RcTranslationQuestions {...props} />)
                return
              default:
                setErrorMessage(`Conversion of \`${catalogEntry.subject}\` resources is currently not supported.`)
            }
            return
          case "sb":
            switch (catalogEntry.flavor_type) {
              case "scripture":
                switch (catalogEntry.flavor) {
                  case "textTranslation":
                    setResourceComponent(<Bible {...props} />)
                    return
                  default:
                    setErrorMessage(`Conversion of SB flavor \`${catalogEntry.flavor}\` is not currently supported.`)
                }
                return
              case "gloss":
                switch (catalogEntry.flavor) {
                  case "textStories":
                    setResourceComponent(<OpenBibleStories {...props} />)
                    return
                }
                return
              default:
                setErrorMessage(`Conversion of SB flavor type \`${catalogEntry.flavor_type}\` is not currently supported.`)
            }
            return
          case "ts":
            setErrorMessage("Conversion of translationStudio repositories is currently not supported.")
            return
          case "tc":
            switch (catalogEntry.subject) {
              case "Aligned Bible":
              case "Bible":
                setResourceComponent(<Bible {...props} />)
                return
              default:
                setErrorMessage(`Conversion of translationCore \`${subject}\` repositories is currently not supported.`)
            }
            return
        }
      }
      setErrorMessage(`Not a valid repository that can be convert.`)
    }
  }, [catalogEntry])

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

  // create the value for the context provider
  const context = {
    state: {
      urlInfo,
      catalogEntry,
      statusMessage,
      errorMessages,
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
      isOpenPrint,
    },
    actions: {
      setStatusMessage,
      setErrorMessage,
      clearErrorMessage,
      setPrintHtml,
      setCanChangeColumns,
      setIsOpenPrint,
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
