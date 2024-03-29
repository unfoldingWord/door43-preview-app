import { useEffect, useState} from 'react';
import { API_PATH } from '@common/constants'
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Unstable_Grid2';
import {
    AppBar,
    Button,
    IconButton,
  } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/joy/CircularProgress'
 

const styles = {
    filterLink: {
        textDecoration: "none", 
        color: "inherit", 
        fontWeight: "bold"
    },
    ltr: {},
    rtl: {
        textAlign: "right",
        languageDirection: "rtl",
    }
}

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'left',
  color: theme.palette.text.secondary,
}));

export function getRelativeTimeString(
    dateStr,
    lang = navigator.language
  ) {
    const date = Date.parse(dateStr)
    // Allow dates or times to be passed
    const timeMs = typeof date === "number" ? date : date.getTime();
  
    // Get the amount of seconds between the given date and now
    const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);
  
    // Array reprsenting one minute, hour, day, week, month, etc in seconds
    const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];
  
    // Array equivalent to the above but in the string representation of the units
    const units = ["second", "minute", "hour", "day", "week", "month", "year"];
  
    // Grab the ideal cutoff unit
    const unitIndex = cutoffs.findIndex(cutoff => cutoff > Math.abs(deltaSeconds));
  
    // Get the divisor to divide from the seconds. E.g. if our unit is "day" our divisor
    // is one day in seconds, so we can divide our seconds by this to get the # of days
    const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
  
    // Intl.RelativeTimeFormat do its magic
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
  }

export const ResourcesCardGrid = ({
  serverInfo,
}) => {
  const [isFetchingEntries, setIsFetchingEntries] = useState(false)
  const [stage, setStage] = useState("latest")
  const [owners, setOwners] = useState([])
  const [languages, setLanguages] = useState([])
  const [subjects, setSubjects] = useState([])
  const [selectedLanguages, setSelectedLanguages] = useState([])
  const [selectedOwners, setSelectedOwners] = useState([])
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [catalogEntries, setCatalogEntries] = useState([])
  const [urlParams, setUrlParams] = useState(new URLSearchParams(window.location.search))
  const [gotAllEntries, setGotAllEntries] = useState(false)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState("released")
  const [order, setOrder] = useState("desc")
  const [searchClicked, setSearchClicked] = useState(false)
  const [loadMoreClicked, setLoadMoreClicked] = useState(false)
  const [error, setError] = useState()

  useEffect(() => {
    if(! urlParams.get("lang") && ! urlParams.get("owner") && ! urlParams.get("subject")) {
        setSelectedLanguages(['en'])
        setSelectedOwners(['unfoldingWord'])
    } else {
        setSelectedLanguages(urlParams.getAll("lang"))
        setSelectedOwners(urlParams.getAll("owner"))
        setSelectedSubjects(urlParams.getAll("subject"))
    }
    if (urlParams.get("stage")) {
        setStage(urlParams.get("stage"))
    }
    if (urlParams.get("sort")) {
        setSort(urlParams.get("sort"))
    }
    if (urlParams.get("order")) {
        setOrder(urlParams.get("order"))
    }
    setSearchClicked(true)
  }, [])

  useEffect(() => {
    const getLanguages = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/languages?stage=other&metadataType=rc&metadataType=sb&metadataType=tc`)
      .then(response => {
        return response.json()
      })
      .then(({data}) => {
        setLanguages(data)
      })
      .catch(e => {
        console.log("Error fetching languages:", e)
        setError("Failed to fetch languages from DCS")
      })
    }

    if (serverInfo?.baseUrl && !isFetchingEntries && !languages.length) {
      getLanguages()
    }
  }, [serverInfo, isFetchingEntries])

  useEffect(() => {
    const fetchOwners = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/owners?stage=${stage}&metadataType=rc&metadataType=sb&metadataType=tc`)
      .then(response => {
        return response.json()
      })
      .then(({data}) => {
        setOwners(data)
      })
      .catch(e => {
        setError("Error fetching providers from DCS")
        console.log(`Error fetching owners:`, e)
      })
    }

    if (serverInfo?.baseUrl && !isFetchingEntries && !owners.length) {
      fetchOwners()
    }
  }, [serverInfo, isFetchingEntries])

  useEffect(() => {
    const fetchSubjects = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/subjects?stage=${stage}&metadataType=rc&metadataType=sb&metadataType=tc`)
      .then(response => {
        return response.json()
      })
      .then(({data}) => {
        setSubjects(data)
      })
      .catch(e => {
        setError("Error fetching subjects from DCS")
        console.log(`Error fetching subjects:`, e)
      })
    }

    if (serverInfo?.baseUrl && !isFetchingEntries && !subjects.length) {
      fetchSubjects()
    }
  }, [serverInfo, isFetchingEntries])

  useEffect(() => {
    const fetchCatalogEntries = async () => {
        let p = page
        let entries = catalogEntries
        let params = urlParams
        if (searchClicked) {
            p = 1
            params = new URLSearchParams()
            selectedOwners.forEach(o => params.append("owner", o))
            selectedLanguages.forEach(l => params.append("lang", l))
            selectedSubjects.forEach(s => params.append("subject", s))
            params.append("stage", stage)
            params.append("sort", sort)
            params.append("order", order)
            setUrlParams(params)
            setGotAllEntries(false)
            window.history.replaceState({id: "100"}, '', `${window.location.href.split('?')[0]}?${params.toString()}`)
        } else {
            p++
        }
        setPage(p)
        params.set("page", p)
        params.set("limit", 100)

        const url = new URL(`${serverInfo.baseUrl}/${API_PATH}/catalog/search`);
        url.search = params
        fetch(url)
          .then(response => response.json())
          .then(({data}) => {
            if (!data.length) {
                setError("No projects found meeting that criteria")
            } else {
                setCatalogEntries([...entries, ...data])
                if (data.length < 100) {
                    setGotAllEntries(true)
                }
            }
          })
          .catch(e => {
            console.log("Error fetching catalog entries:", e)
            setError("Failed to fetch projects from DCS")
          })
          .finally(() => {
            setIsFetchingEntries(false)
            setLoadMoreClicked(false)
            setSearchClicked(false)
          })
    }

    if (serverInfo?.baseUrl && (searchClicked || loadMoreClicked)) {
        setError()
        setIsFetchingEntries(true)
        fetchCatalogEntries()
    }
  }, [serverInfo, searchClicked, loadMoreClicked])

  return (
  <>
    <AppBar
          position="relative"
          sx={{ backgroundColor: "white", top: "0", color: "black" }}
        >
    <Box
      alignItems="center"    
      component="form"
      sx={{
        '& > :not(style)': { m: 1 },
      }}
      noValidate
    >
      <Autocomplete
        id="language-select"
        multiple
        freeSolo
        autoHighlight
        clearOnEscape
        sx={{ width: "auto", minWidth: "300px", display: "inline-block"}}
        value={selectedLanguages}
        options={languages.map(l => l.lc)}
        getOptionLabel={option => {
            let ln = ""
            for(let i = 0; i < languages.length; i++) {
              if (languages[i].lc == option) {
                ln = languages[i].ln
                break
              }
            }
            return `${ln} (${option})`
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Language"
            variant="outlined"
          />
        )}
        // isOptionEqualToValue={(option, value) => option.lc === value}
        onChange={
          (event, selected) => {
            setSelectedLanguages(selected)
          }
        }
      />
      <Autocomplete
        id="owner-select"
        multiple
        freeSolo
        autoHighlight
        clearOnEscape
        sx={{ width: "auto", minWidth: "300px", display: "inline-block"}}
        options={owners.map(o => o.username)}
        value={selectedOwners}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Owner"
            variant="outlined"
          />
        )}
        onChange={
          (event, selected) => {
            setSelectedOwners(selected)
          }
        }
      />
      <div style={{display: "inline-block"}}>
      <Autocomplete
        id="subject-select"
        multiple
        freeSolo
        autoHighlight
        clearOnEscape
        sx={{ width: "auto", minWidth: "300px", display: "inline-block"}}
        options={subjects}
        value={selectedSubjects}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Subject"
            variant="outlined"
          />
        )}
        onChange={
          (event, selected) => {
            setSelectedSubjects(selected)
          }
        }
      />
      <IconButton onClick={() => {setSearchClicked(true); setCatalogEntries([])}} disabled={searchClicked}>
        <SearchIcon />
      </IconButton>
      </div>
          </Box>
        </AppBar>
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid container xs={12} spacing={4}>
        {catalogEntries.map(entry => {
          let releasedStr = ""
          if (entry.repo.catalog?.prod) {
            releasedStr = `Released ${getRelativeTimeString(entry.repo.catalog.prod.released)}`
          } else if (entry.repo.catalog?.preprod) {
            releasedStr = `Pre-Released ${getRelativeTimeString(entry.repo.catalog.preprod.released)}`
          } else {
            releasedStr = `${entry.ref_type == "branch" ? "Last updated" : "Released"} ${getRelativeTimeString(entry.released)}`
          }
          return (<Grid xs={6} lg={3} key={entry.id}>
            <Item sx={styles[entry.language_direction]}>
              <Box
                id="category-a"
                sx={{ fontSize: '12px', textAlign: 'center' }}
              >
                <a key="title" style={{textDecoration: "none"}} href={`/u/${entry.full_name}`} target="_blank" rel="noopener noreferrer">{entry.title}</a> ({entry.abbreviation})
                <div key="stages">
                  {Object.values(entry.repo?.catalog || {"latest": {branch_or_tag_name: entry.branch_or_tag_name}}).filter(c => c).map((c, i) => 
                  <span key={c.branch_or_tag_name}>
                    {i == 0 ? "" : ", "}
                    <a style={{textDecoration: "none"}} key={c.branch_or_tag_name} href={`/u/${entry.full_name}/${c.branch_or_tag_name}`} target="_blank" rel="noopener noreferrer">{c.branch_or_tag_name}</a>
                  </span>)
                }</div>
              </Box>
              <Box component="div" aria-labelledby="category-a" sx={{ pl: 2 }}>
                <div key="space">&nbsp;</div>
                <div key="lang"><a style={styles.filterLink} href={`?lang=${entry.language}`}>{entry.language_title} ({entry.language})</a></div>
                <div key="owner"><a style={styles.filterLink} href={`?owner=${encodeURI(entry.owner)}`}>{entry.owner}</a></div>
                <div key="subject"><a style={styles.filterLink} href={`?subject=${encodeURI(entry.subject)}`}>{entry.subject}</a></div>
                <div key="release" style={{textAlign: "center", fontStyle: "italic"}}>{releasedStr}</div>
              </Box>
            </Item>
          </Grid>)})}
        </Grid>
      </Grid>
    </Box>
    {error &&
      <Typography id="error" sx={{textAlign: "center", color: "red"}}>
        {error}
      </Typography>}
    {!gotAllEntries && !searchClicked && !error && catalogEntries.length > 0 &&  
        <div style={{textAlign: "center"}} key="load">
            <Button onClick={() => setLoadMoreClicked(true)} disabled={loadMoreClicked}>Load More...</Button>
        </div>}
    {(loadMoreClicked || searchClicked) && 
        <div style={{textAlign: "center"}} key="spinner">
            <CircularProgress/>
        </div>}
  </>
  );
}
