import React, { useState, useEffect, useContext } from 'react';
import { ViewModule, ViewList } from '@mui/icons-material';
import { ResourcesCardGrid } from '@components/ResourcesCardGrid';
import { ResourcesListAccordion } from '@components/ResourcesListAccordion';

// Material UI imports
import {
  Box,
  AppBar,
  Button,
  IconButton,
  TextField,
  Autocomplete,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle, 
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  Tabs,
  Tab,
  MenuItem,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

// Context imports
import { AppContext } from '@contexts/App.context';

// Constants
import { API_PATH } from '@common/constants';

const DEFAULT_LANGS = ['en'];
const DEFAULT_OWNERS = ['unfoldingWord'];
const DEFAULT_SUBJECTS = [];
const DEFAULT_SORT = 'released';
const DEFAULT_ORDER = 'desc';

const urlParams = new URLSearchParams(window.location.search);

export const HomePageSearch = () => {
  const hash = window.location.hash;

  const {
    state: { serverInfo, urlInfo },
  } = useContext(AppContext);

  const [selectedTab, setSelectedTab] = useState(hash === '#list' ? "list" : "grid");
  const [stage, setStage] = useState('latest');
  const [owners, setOwners] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedOwners, setSelectedOwners] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [order, setOrder] = useState(DEFAULT_ORDER);
  const [errorMessage, setErrorMessage] = useState();
  const [openSortModal, setOpenSortModal] = useState(false);

  useEffect(() => {
    const setDefaultsAndSearch = async () => {
      const paramsCount = Array.from(urlParams.entries()).length;

      if (urlInfo.lang) {
        setSelectedLanguages([urlInfo?.lang]);
      } else if (urlParams.get('lang')) {
        setSelectedLanguages(urlParams.getAll('lang'));
      } else if (!urlInfo.owner && ! paramsCount) {
        setSelectedLanguages(DEFAULT_LANGS);
      }

      if (urlInfo.owner) {
        setSelectedOwners([urlInfo.owner]);
      } else if (urlParams.get('owner')) {
        setSelectedOwners(urlParams.getAll('owner'));
      } else if (!urlInfo.lang  && ! paramsCount) {
        setSelectedOwners(DEFAULT_OWNERS);
      }

      if (urlParams.get('subject')) {
        setSelectedSubjects(urlParams.getAll('subject'));
      } else if (!urlInfo.owner && ! urlInfo.lang   && ! paramsCount) {
        setSelectedSubjects(DEFAULT_SUBJECTS);
      }

      if (urlParams.get('stage')) {
        setStage(urlParams.get('stage'));
      }

      if (urlParams.get('sort')) {
        setSort(urlParams.get('sort'));
      }

      if (urlParams.get('order')) {
        setOrder(urlParams.get('order'));
      }
    };

    if (urlInfo) {
      setDefaultsAndSearch();
    }
  }, [urlInfo]);

  useEffect(() => {
    const getLanguages = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/languages?stage=other&metadataType=rc&metadataType=sb&metadataType=tc&metadataType=ts`, {
        cache: 'default',
      })
        .then((response) => {
          return response.json();
        })
        .then(({ data }) => {
          setLanguages(data);
        })
        .catch((e) => {
          console.log('Error fetching languages:', e);
          setErrorMessage('Failed to fetch languages from DCS');
        });
    };

    if (serverInfo?.baseUrl && !languages.length) {
      getLanguages();
    }
  }, [serverInfo, languages.length]);

  useEffect(() => {
    const fetchOwners = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/owners?stage=${stage}&metadataType=rc&metadataType=sb&metadataType=tc&metadataType=ts`, {
        cache: 'default',
      })
        .then((response) => {
          return response.json();
        })
        .then(({ data }) => {
          setOwners(data);
        })
        .catch((e) => {
          setErrorMessage('Error fetching providers from DCS');
          console.log(`Error fetching owners:`, e);
        });
    };

    if (serverInfo?.baseUrl && !owners.length) {
      fetchOwners();
    }
  }, [serverInfo, owners.length, stage]);

  useEffect(() => {
    const fetchSubjects = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/subjects?stage=${stage}&metadataType=rc&metadataType=sb&metadataType=tc&metadataType=ts`, {
        cache: 'default',
      })
        .then((response) => {
          return response.json();
        })
        .then(({ data }) => {
          setSubjects(data);
        })
        .catch((e) => {
          setErrorMessage('Error fetching subjects from DCS');
          console.log(`Error fetching subjects:`, e);
        });
    };

    if (serverInfo?.baseUrl && !subjects.length) {
      fetchSubjects();
    }
  }, [serverInfo, subjects.length, stage]);

  const handleChange = (event, newValue) => {
    console.log(newValue);
    setSelectedTab(newValue);
    window.location.hash = `#${newValue}`;
  };

  useEffect(() => {
    window.onhashchange = () => {
      setSelectedTab(window.location.hash === '#list' ? 'list' : 'grid');
    };
  }, []);

  const resourcesProps = {
    serverInfo: serverInfo,
    languages: selectedLanguages,
    owners: selectedOwners,
    subjects: selectedSubjects,
    stage: stage,
  }

  return (
    <Box>
      <AppBar position="relative" sx={{ backgroundColor: 'white', top: '0', color: 'black', marginBottom: '10px' }}>
        <Box
          alignItems="center"
          component="form"
          sx={{
            '& > :not(style)': { m: 1 },
          }}
          noValidate
        >
          {<Autocomplete
            id="language-select"
            multiple
            freeSolo
            autoHighlight
            clearOnEscape
            sx={{ width: 'auto', minWidth: '300px', display: 'inline-block' }}
            value={selectedLanguages}
            options={languages.map((l) => l.lc)}
            getOptionLabel={(option) => {
              let ln = '';
              for (let i = 0; i < languages.length; i++) {
                if (languages[i].lc == option) {
                  ln = languages[i].ln;
                  break;
                }
              }
              return `${ln} (${option})`;
            }}
            renderInput={(params) => <TextField {...params} label="Language" variant="outlined" />}
            // isOptionEqualToValue={(option, value) => option.lc === value}
            onChange={(event, selected) => {
              setSelectedLanguages(selected);
              urlParams.delete('lang');
              if (selected.length) {
                selected.forEach((item) => {
                  urlParams.append('lang', item);
                });
              } else {
                urlParams.append('lang', '');
              }
              window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
            }}
          />}
          {! urlInfo?.owner && <Autocomplete
            id="owner-select"
            multiple
            freeSolo
            autoHighlight
            clearOnEscape
            sx={{ width: 'auto', minWidth: '300px', display: 'inline-block' }}
            options={owners.map((o) => o.username)}
            value={selectedOwners}
            renderInput={(params) => <TextField {...params} label="Owner" variant="outlined" />}
            onChange={(event, selected) => {
              setSelectedOwners(selected);
              urlParams.delete('owner');
              if (selected.length) {
                selected.forEach((item) => {
                  urlParams.append('owner', item);
                });
              } else {
                urlParams.append('owner', '');
              }
              window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
            }}
          />}
          <Autocomplete
            id="subject-select"
            multiple
            freeSolo
            autoHighlight
            clearOnEscape
            sx={{ width: 'auto', minWidth: '300px', display: 'inline-block' }}
            options={subjects}
            value={selectedSubjects}
            renderInput={(params) => <TextField {...params} label="Subject" variant="outlined" />}
            onChange={(event, selected) => {
              setSelectedSubjects(selected);
              urlParams.delete('subject');
              if (selected.length) {
                selected.forEach((item) => {
                  urlParams.append('subject', item);
                });
              } else {
                urlParams.append('subject', '');
              }
              window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
            }}
          />

          <div style={{ display: 'inline-block' }}>
            <IconButton onClick={() => setOpenSortModal(true)}>
              <FilterListIcon />
            </IconButton>
          </div>

          <Dialog open={openSortModal} onClose={() => setOpenSortModal(false)}>
            <DialogTitle>Sort by</DialogTitle>
            <DialogContent>
              <FormControl fullWidth>
                <Select
                  labelId="sort-label"
                  id="sort-select"
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    urlParams.set('sort', event.target.value);
                    window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
                  }}
                >
                  <MenuItem value="released">Release Date</MenuItem>
                  <MenuItem value="lang">Language</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                  <MenuItem value="subject">Subject</MenuItem>
                </Select>
                <ToggleButtonGroup
                  value={order}
                  exclusive
                  onChange={(event, newOrder) => {
                    if (!newOrder) {
                      return;
                    }
                    setOrder(newOrder);
                    urlParams.set('order', newOrder);
                    window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
                  }}
                  aria-label="Sort Order"
                  sx={{paddingTop: "10px", textAlign: "center", display: "block"}}
                >
                  <Tooltip title="Ascending" arrow>
                    <ToggleButton value="asc" aria-label="Ascending">
                      <Typography variant="caption">{sort == "released" ? "2001" : "A"}<ArrowUpwardIcon />{sort == "released" ? new Date().getFullYear() : "Z"}</Typography>
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title="Descending" arrow>
                    <ToggleButton value="desc" aria-label="Descending">
                      <Typography variant="caption">{sort == "released" ? new Date().getFullYear() : "Z"}<ArrowDownwardIcon />{sort == "released" ? "2001" : "A"}</Typography>
                    </ToggleButton>
                  </Tooltip>
                </ToggleButtonGroup>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenSortModal(false)}>Close</Button>
            </DialogActions>
          </Dialog>
          <Tooltip title="Show only releases" arrow>
            <FormControlLabel
              control={
                <Checkbox
                  checked={stage == 'prod'}
                  onChange={(event) => {
                    const s = event.target.checked ? 'prod' : 'latest';
                    setStage(s);
                    urlParams.set('stage', s);
                    window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
                  }}
                  name="onlyReleases"
                  color="primary"
                />
             }
              label="Releases"
            />
          </Tooltip>
        </Box>
      </AppBar>
      {errorMessage && (
        <Typography id="error" sx={{ paddingTop: '20px', textAlign: 'center', color: 'red' }}>
          {errorMessage}
        </Typography>
      )}
      <Tabs value={selectedTab} onChange={handleChange} centered>
        <Tab icon={<ViewModule />} value="grid" label="Grid View" />
        <Tab icon={<ViewList />} value="list" label="List View" />
      </Tabs>
      <div id="list-content" style={{display: selectedTab === 'list' ? 'block' : 'none'}}>
        <ResourcesListAccordion {...resourcesProps} /> :
      </div>
      <div id="grid-content" style={{display: selectedTab === 'grid' ? 'block' : 'none'}}>
        <ResourcesCardGrid {...resourcesProps} />
      </div>
    </Box>
  );
};

export default HomePageSearch;