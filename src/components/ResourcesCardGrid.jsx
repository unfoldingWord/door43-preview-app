// React imports
import { useEffect, useState, useContext, useRef } from 'react';

// Material UI imports
import { Box, Grid, AppBar, Button, IconButton, TextField, Autocomplete, Typography, Tooltip, FormControlLabel, Checkbox, ToggleButton, ToggleButtonGroup } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CircularProgress from '@mui/joy/CircularProgress';

import { Dialog, DialogTitle, DialogContent, DialogActions, FormControl, Select, MenuItem } from '@mui/material';
import SortIcon from '@mui/icons-material/Sort';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

// Components
import CatalogEntriesGrid from './CatalogEntriesGrid';

// Context imports
import { AppContext } from '@components/App.context';

// Constants
import { API_PATH } from '@common/constants';

const DEFAULT_LIMIT = 50;
const DEFAULT_SUBJECTS = [];
const DEFAULT_SORT = 'released';
const DEFAULT_ORDER = 'desc';

const urlParams = new URLSearchParams(window.location.search);

export const ResourcesCardGrid = () => {
  const {
    state: { serverInfo, urlInfo },
  } = useContext(AppContext);

  const [isFetchingEntries, setIsFetchingEntries] = useState(false);
  const [stage, setStage] = useState(urlInfo?.owner ? 'latest' : 'prod');
  const [topic, setTopic] = useState(urlInfo?.owner ? '' : 'tc-ready');
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
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const setDefaultsAndSearch = async () => {
      const paramsCount = Array.from(urlParams.entries()).length;

      if (urlInfo.lang) {
        setSelectedLanguages([urlInfo?.lang]);
      } else if (urlParams.get('lang')) {
        setSelectedLanguages(urlParams.getAll('lang'));
      }

      if (urlInfo.owner) {
        setSelectedOwners([urlInfo.owner]);
      } else if (urlParams.get('owner')) {
        setSelectedOwners(urlParams.getAll('owner'));
      }

      if (urlParams.get('subject')) {
        setSelectedSubjects(urlParams.getAll('subject'));
      } else if (!urlInfo.owner && !urlInfo.lang && !paramsCount) {
        setSelectedSubjects(DEFAULT_SUBJECTS);
      }

      if (urlParams.get('stage')) {
        setStage(urlParams.get('stage'));
      }

      if (urlParams.has('topic')) {
        setTopic(urlParams.get('topic'));
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
      if (topic) {
        params.append('topic', topic);
      }
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
            if (data.length < DEFAULT_LIMIT) {
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadMoreClicked && !isFetchingEntries) {
          setLoadMoreClicked(true);
        }
      },
      { threshold: 1.0 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [loadMoreClicked, isFetchingEntries]);

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

  let extraItem = null;

  if (!gotAllEntries && !searchClicked && !error && catalogEntries.length > 0 && !loadMoreClicked) {
    extraItem = (
      <Grid item xs={12} sm={6} md={4} lg={3} key="load-more" alignItems="stretch">
        <div ref={loadMoreRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
          <Button onClick={() => setLoadMoreClicked(true)} disabled={loadMoreClicked} style={{ textAlign: 'center', fontWeight: 'bold' }}>
            Load more...
          </Button>
        </div>
      </Grid>
    );
  } else if (loadMoreClicked || searchClicked) {
    extraItem = (
      <Grid item xs={12} sm={6} md={4} lg={3} key="load-more" alignItems="stretch">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', justifyContent: 'center', textAlign: 'center' }}>
          <CircularProgress style={{ textAlign: 'center', width: '100%' }} />
        </div>
      </Grid>
    );
  }

  return (
    <>
      <AppBar position="relative" sx={{ backgroundColor: 'white', top: '0', color: 'black', marginBottom: '10px' }}>
        <Box
          alignItems="center"
          component="form"
          sx={{
            '& > :not(style)': { m: 1 },
            display: 'flex',
            flexWrap: 'wrap',
          }}
          noValidate
        >
          <Grid container alignItems="center" spacing={1}>
            <Grid item>
              {
                <Autocomplete
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
                />
              }
            </Grid>
            <Grid item>
              {!urlInfo?.owner && (
                <Autocomplete
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
                />
              )}
            </Grid>
            <Grid item>
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
            </Grid>
            <Grid item sx={{ p: 0, m: 0 }}>
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
            </Grid>
            <Grid item sx={{ p: 0, m: 0 }}>
              <Tooltip title="Show only resources that have been marked ready for use with translationCore apps" arrow>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={topic === 'tc-ready'}
                      onChange={(event) => {
                        const t = event.target.checked ? 'tc-ready' : '';
                        setTopic(t);
                        setCatalogEntries([]);
                        setSearchClicked(true);
                        urlParams.set('topic', t);
                        window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
                      }}
                      name="onlyTcReady"
                      color="primary"
                    />
                  }
                  label="tC-Ready"
                />
              </Tooltip>
            </Grid>
            <Grid item>
              <Tooltip title="Sort Order" arrow>
                <IconButton onClick={handleOpenSortModal}>
                  <SortIcon sx={{ color: '#1976d2', margin: 1, fontSize: '1.5em', fontWeight: 'bold' }} />
                </IconButton>
              </Tooltip>
            </Grid>
            <Grid item>
              <Button
                onClick={() => {
                  setSearchClicked(true);
                  setCatalogEntries([]);
                }}
                disabled={searchClicked}
                sx={{
                  backgroundColor: '#1976d2',
                  color: '#f0f0f0',
                  boxShadow: '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)',
                  '&:hover': {
                    backgroundColor: '#1565c0',
                  },
                  '&:disabled': {
                    backgroundColor: '#1976d2',
                    color: '#b0b0b0',
                  },
                }}
              >
                <SearchIcon sx={{ color: '#f0f0f0' }} /> Search
              </Button>
            </Grid>
          </Grid>
        </Box>
      </AppBar>
      <Box sx={{ flexGrow: 1, margin: '30px' }}>
        <Grid container spacing={2}>
          <CatalogEntriesGrid catalogEntries={catalogEntries} stage={stage} topic={topic} extraItem={extraItem} />
        </Grid>
      </Box>
      {error && (
        <Typography id="error" sx={{ paddingTop: '20px', textAlign: 'center', color: 'red' }}>
          {error}
        </Typography>
      )}
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
                if (!newOrder) {
                  return;
                }
                setOrder(newOrder);
                urlParams.set('order', newOrder);
                window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${urlParams.toString()}`);
              }}
              aria-label="Sort Order"
              sx={{ paddingTop: '10px', textAlign: 'center', display: 'block' }}
            >
              <Tooltip title="Ascending" arrow>
                <ToggleButton value="asc" aria-label="Ascending">
                  <Typography variant="caption">
                    {sort == 'released' ? '2001' : 'A'}
                    <ArrowUpwardIcon />
                    {sort == 'released' ? new Date().getFullYear() : 'Z'}
                  </Typography>
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Descending" arrow>
                <ToggleButton value="desc" aria-label="Descending">
                  <Typography variant="caption">
                    {sort == 'released' ? new Date().getFullYear() : 'Z'}
                    <ArrowDownwardIcon />
                    {sort == 'released' ? '2001' : 'A'}
                  </Typography>
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
    </>
  );
};
