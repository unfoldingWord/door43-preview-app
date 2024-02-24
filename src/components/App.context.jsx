import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { DCS_SERVERS, API_PATH } from '@common/constants'
import { getCatalogEntry } from '@libs/core/lib/dcsApi'

// Converter components
import Bible from '@libs/Bible/components/Bible'
import OpenBibleStories from '@libs/openBibleStories/components/OpenBibleStories'
import RcTranslationAcademy from '@libs/rcTranslationAcademy/components/RcTranslationAcademy'
import RcTranslationNotes from '@libs/rcTranslationNotes/components/RcTranslationNotes'
import RcTranslationQuestions from '@libs/rcTranslationQuestions/components/RcTranslationQuestions'


export const AppContext = React.createContext()

export function AppContextProvider({ children }) {
  const [statusMessage, setStatusMessage] = useState(<>Preparing Preview.<br/>Please wait...</>)
  const [errorMessages, setErrorMessages] = useState([])
  const [urlInfo, setUrlInfo] = useState()
  const [serverInfo, setServerInfo] = useState()
  const [buildInfo, setBuildInfo] = useState()
  const [repo, setRepo] = useState()
  const [catalogEntry, setCatalogEntry] = useState()
  const [ResourceComponent, setResourceComponent] = useState()
  const [htmlSections, setHtmlSections] = useState({cover: "", copyright: "", toc: "", body: ""})
  const [webCss, setWebCss] = useState("")
  const [printCss, setPrintCss] = useState("")
  const [canChangeColumns, setCanChangeColumns] = useState(false)
  const [isOpenPrint, setIsOpenPrint] = useState(false)
  const [printOptions, setPrintOptions] = useState({})
  const [documentReady, setDocumentReady] = useState(false)
  const [documentAnchor, setDocumentAnchor] = useState('')
  const [lastSeenAnchor, setLastSeenAnchor] = useState()

  /*** For new resource model ***/
  const [organizations, setOrganizations] = useState()
  const [branches,setBranches] = useState()
  const [tags,setTags] = useState()
  const [repos,setRepos] = useState()
  const [languages,setLanguages] = useState()

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
      const urlParts = url.pathname.replace(/^\/(u\/){0,1}/, "").replace(/\/+$/, "").replace(/\/preview\//, "/").replace(/\/(branch|tag)\//, "/").split("/")
      if(urlParts.length < 2) {
        setErrorMessage("Home Page (under construction)")
        setStatusMessage("")
        return
      }
      const info = {
        owner: urlParts[0] || "",
        repo: urlParts[1] || "",
        ref: urlParts[2] == "preview" ? urlParts.slice(3).join('/') : urlParts.slice(2).join('/'),
        hash: url.hash.replace('#', ''),
        hashParts: url.hash ? url.hash.replace('#', '').split('-') : [],
      }
      setUrlInfo(info)
      setDocumentAnchor(info.hash)
    }

    getServerInfo().catch(e => setErrorMessage(e.message))
    getUrlInfo().catch(e => setErrorMessage(e.message))
  }, [])

  useEffect(() => {
    const fetchRepo = async () => {
      const repoUrl = `${serverInfo.baseUrl}/${API_PATH}/repos/${urlInfo.owner}/${urlInfo.repo}`
      fetch(repoUrl)
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
        setErrorMessage(<>Failed to connect to DCS. Unable to fetch <a href={repoUrl} target="_blank">{urlInfo.owner}/{urlInfo.repo}</a></>)
      })
    }

    if (serverInfo && urlInfo) {
      fetchRepo().catch(e => setErrorMessage(e.message))
    }
  }, [serverInfo, urlInfo])

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
        if (catalogEntry.repo?.title && catalogEntry.repo?.subject && catalogEntry.repo?.ingredients && catalogEntry.repo?.metadata_type) {
          catalogEntry.title = catalogEntry.repo.title
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
        switch (catalogEntry.metadata_type) {
          case "rc":
            switch (catalogEntry.subject) {
              case "Aligned Bible":
              case "Bible":
              case "Greek New Testament":
              case "Hebrew Old Testament":
                setResourceComponent(() => Bible)
                return
              case "Open Bible Stories":
                setResourceComponent(() => OpenBibleStories)
                return
              case "Translation Academy":
                setResourceComponent(() => RcTranslationAcademy)
                return
              case "TSV Translation Notes":
                setResourceComponent(() => RcTranslationNotes)
                return
              case "TSV Translation Questions":
                setResourceComponent(() => RcTranslationQuestions)
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
                    setResourceComponent(() => Bible)
                    return
                  default:
                    setErrorMessage(`Conversion of SB flavor \`${catalogEntry.flavor}\` is not currently supported.`)
                }
                return
              case "gloss":
                switch (catalogEntry.flavor) {
                  case "textStories":
                    setResourceComponent(() => OpenBibleStories)
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
                setResourceComponent(() => Bible)
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
      ResourceComponent,
      htmlSections,
      webCss,
      printCss,
      canChangeColumns,
      buildInfo,
      serverInfo,
      isOpenPrint,
      printOptions,
      documentReady,
      documentAnchor,
      lastSeenAnchor,
    },
    actions: {
      onPrintClick,
      setStatusMessage,
      setErrorMessage,
      clearErrorMessage,
      setHtmlSections,
      setWebCss,
      setPrintCss,
      setCanChangeColumns,
      setIsOpenPrint,
      setPrintOptions,
      setDocumentReady,
      setDocumentAnchor,
      setLastSeenAnchor,
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
