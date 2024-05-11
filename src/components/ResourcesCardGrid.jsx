// React imports
import { useEffect, useState, useContext } from 'react';

// Material UI imports
import {
  Box,
  Unstable_Grid2 as Grid,
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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CircularProgress from '@mui/joy/CircularProgress';

import { Dialog, DialogTitle, DialogContent, DialogActions, FormControl, Select, MenuItem } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

// Components
import CatalogEntriesGrid from './CatalogEntriesGrid';

// Context imports
import { AppContext } from '@components/App.context';

// Constants
import { API_PATH } from '@common/constants';

const DEFAULT_LIMIT = 50;
const DEFAULT_LANGS = ['en'];
const DEFAULT_OWNERS = ['unfoldingWord'];
const DEFAULT_SUBJECTS = [];
const DEFAULT_SORT = 'released';
const DEFAULT_ORDER = 'desc';

const urlParams = new URLSearchParams(window.location.search);

export const ResourcesCardGrid = () => {
  const {
    state: { serverInfo, urlInfo },
  } = useContext(AppContext);

  const [isFetchingEntries, setIsFetchingEntries] = useState(false);
  const [stage, setStage] = useState('latest');
  const [owners, setOwners] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedOwners, setSelectedOwners] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [catalogEntries, setCatalogEntries] = useState([]);
  const [gotAllEntries, setGotAllEntries] = useState(false);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [order, setOrder] = useState(DEFAULT_ORDER);
  const [searchClicked, setSearchClicked] = useState(false);
  const [loadMoreClicked, setLoadMoreClicked] = useState(false);
  const [error, setError] = useState();

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
      setSearchClicked(true);
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
          setError('Failed to fetch languages from DCS');
        });
    };

    if (serverInfo?.baseUrl && !isFetchingEntries && !languages.length) {
      getLanguages();
    }
  }, [serverInfo, isFetchingEntries, languages.length]);

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
          setError('Error fetching providers from DCS');
          console.log(`Error fetching owners:`, e);
        });
    };

    if (serverInfo?.baseUrl && !isFetchingEntries && !owners.length) {
      fetchOwners();
    }
  }, [serverInfo, isFetchingEntries, owners.length, stage]);

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
          setError('Error fetching subjects from DCS');
          console.log(`Error fetching subjects:`, e);
        });
    };

    if (serverInfo?.baseUrl && !isFetchingEntries && !subjects.length) {
      fetchSubjects();
    }
  }, [serverInfo, isFetchingEntries, subjects.length, stage]);

  useEffect(() => {
    const fetchCatalogEntries = async () => {
      let p = page;
      let params = new URLSearchParams();
      selectedOwners.forEach((o) => params.append('owner', o));
      selectedLanguages.forEach((l) => params.append('lang', l));
      selectedSubjects.forEach((s) => params.append('subject', s));
      params.append('stage', stage);
      params.append('sort', sort);
      params.append('order', order);

      if (searchClicked) {
        p = 1;
        // window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${params.toString()}`);
        setGotAllEntries(false);
      } else {
        p++;
      }
      setPage(p);
      params.set('page', p);
      params.set('limit', DEFAULT_LIMIT);

      const url = new URL(`${serverInfo.baseUrl}/${API_PATH}/catalog/search`);
      url.search = params;
      fetch(url, {
        cache: 'default',
      })
        .then((response) => response.json())
        .then(({ data }) => {
          if (!data.length) {
            setError('No projects found meeting this search criteria');
          } else {
            setCatalogEntries((prevState) => [...prevState, ...data]);
            if (data.length < 100) {
              setGotAllEntries(true);
            }
          }
        })
        .catch((e) => {
          console.log('Error fetching catalog entries:', e);
          setError('Failed to fetch projects from DCS');
        })
        .finally(() => {
          setIsFetchingEntries(false);
          setLoadMoreClicked(false);
          setSearchClicked(false);
        });
    };

    if (serverInfo?.baseUrl && (searchClicked || loadMoreClicked) && !isFetchingEntries) {
      setError();
      setIsFetchingEntries(true);
      fetchCatalogEntries();
    }
  }, [serverInfo, searchClicked, isFetchingEntries, loadMoreClicked, selectedLanguages, selectedOwners, selectedSubjects, order, page, sort, stage]);

  const handleOpenSortModal = () => {
    setOpenSortModal(true);
  };

  const handleCloseSortModal = (search) => {
    setOpenSortModal(false);
    if (search) {
      setSearchClicked(true);
      setCatalogEntries([]);
    }
  };

  return (
    <>
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

          <Button
            onClick={() => {
              setSearchClicked(true);
              setCatalogEntries([]);
            }}
            disabled={searchClicked}
          >
            <SearchIcon /> Search
          </Button>

          <div style={{ display: 'inline-block' }}>
            <IconButton onClick={handleOpenSortModal}>
              <FilterListIcon />
            </IconButton>
          </div>

          <Dialog open={openSortModal} onClose={handleCloseSortModal}>
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
                    setOrder(newOrder);
                    urlParams.set('order', newOrder);
                    window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
                  }}
                  aria-label="Sort Order"
                  sx={{paddingTop: "10px", textAlign: "center", display: "block"}}
                >
                  <Tooltip title="Ascending" arrow>
                    <ToggleButton value="asc" aria-label="Ascending">
                      <ArrowUpwardIcon />
                    </ToggleButton>
                  </Tooltip>
                  <Tooltip title="Descending" arrow>
                    <ToggleButton value="desc" aria-label="Descending">
                      <ArrowDownwardIcon />
                    </ToggleButton>
                  </Tooltip>
                </ToggleButtonGroup>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseSortModal}>Close</Button>
              <Button
                onClick={() => {
                  // Apply filter and sort logic here
                  handleCloseSortModal(true);
                }}
              >
                Apply
              </Button>
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
                    setCatalogEntries([]);
                    setSearchClicked(true);
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
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          <CatalogEntriesGrid catalogEntries={catalogEntries} stage={stage} />
        </Grid>
      </Box>
      {error && (
        <Typography id="error" sx={{ paddingTop: '20px', textAlign: 'center', color: 'red' }}>
          {error}
        </Typography>
      )}
      {!gotAllEntries && !searchClicked && !error && catalogEntries.length > 0 && !loadMoreClicked && (
        <div style={{ textAlign: 'center' }} key="load">
          <Button onClick={() => setLoadMoreClicked(true)} disabled={loadMoreClicked}>
            Load More...
          </Button>
        </div>
      )}
      {(loadMoreClicked || searchClicked) && (
        <div style={{ textAlign: 'center', marginTop: '20px' }} key="spinner">
          <CircularProgress />
        </div>
      )}
    </>
  );
};
