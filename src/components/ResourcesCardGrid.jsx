// React imports
import { useEffect, useState, useContext } from 'react';

// Material UI imports
import { styled } from '@mui/material/styles';
import {
  Box,
  Paper,
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

// Context imports
import { AppContext } from '@components/App.context';

// Constants
import { API_PATH } from '@common/constants';

// Helpers
import { getRelativeTimeString } from '@helpers/datetime';

const styles = {
  filterLink: {
    textDecoration: 'none',
    color: 'inherit',
    fontWeight: 'bold',
  },
  ltr: {},
  rtl: {
    textAlign: 'right',
    languageDirection: 'rtl',
  },
};

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'left',
  color: theme.palette.text.secondary,
}));

export const ResourcesCardGrid = () => {
  const {
    state: { serverInfo, authToken },
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
  const [urlParams, setUrlParams] = useState(new URLSearchParams(window.location.search));
  const [gotAllEntries, setGotAllEntries] = useState(false);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState('released');
  const [order, setOrder] = useState('desc');
  const [searchClicked, setSearchClicked] = useState(false);
  const [loadMoreClicked, setLoadMoreClicked] = useState(false);
  const [error, setError] = useState();
  const [onlyReleases, setOnlyReleases] = useState(false);

  const [openSortModal, setOpenSortModal] = useState(false);

  useEffect(() => {
    if (!urlParams.get('lang') && !urlParams.get('owner') && !urlParams.get('subject')) {
      setSelectedLanguages(['en']);
      setSelectedOwners(['unfoldingWord']);
    } else {
      setSelectedLanguages(urlParams.getAll('lang'));
      setSelectedOwners(urlParams.getAll('owner'));
      setSelectedSubjects(urlParams.getAll('subject'));
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
  }, [urlParams]);

  useEffect(() => {
    const getLanguages = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/languages?stage=other&metadataType=rc&metadataType=sb&metadataType=tc`)
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
  }, [serverInfo, isFetchingEntries]);

  useEffect(() => {
    const fetchOwners = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/owners?stage=${stage}&metadataType=rc&metadataType=sb&metadataType=tc`)
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
  }, [serverInfo, isFetchingEntries]);

  useEffect(() => {
    const fetchSubjects = async () => {
      fetch(`${serverInfo.baseUrl}/${API_PATH}/catalog/list/subjects?stage=${stage}&metadataType=rc&metadataType=sb&metadataType=tc`)
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
  }, [serverInfo, isFetchingEntries]);

  useEffect(() => {
    const fetchCatalogEntries = async () => {
      let p = page;
      let entries = catalogEntries;
      let params = urlParams;
      if (searchClicked) {
        p = 1;
        params = new URLSearchParams();
        selectedOwners.forEach((o) => params.append('owner', o));
        selectedLanguages.forEach((l) => params.append('lang', l));
        selectedSubjects.forEach((s) => params.append('subject', s));
        params.append('stage', stage);
        params.append('sort', sort);
        params.append('order', order);
        setUrlParams(params);
        setGotAllEntries(false);
        window.history.replaceState({ id: '100' }, '', `${window.location.href.split('?')[0]}?${params.toString()}`);
      } else {
        p++;
      }
      setPage(p);
      params.set('page', p);
      params.set('limit', 100);

      const url = new URL(`${serverInfo.baseUrl}/${API_PATH}/catalog/search`);
      url.search = params;
      fetch(url)
        .then((response) => response.json())
        .then(({ data }) => {
          if (!data.length) {
            setError('No projects found meeting that criteria');
          } else {
            setCatalogEntries([...entries, ...data]);
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
  }, [serverInfo, searchClicked, isFetchingEntries, loadMoreClicked, selectedLanguages, selectedOwners, selectedSubjects]);

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

  const handleSortChange = (event) => {
    setSort(event.target.value);
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
            }}
          />
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
            }}
          />
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
                <Select labelId="sort-label" id="sort-select" value={sort} onChange={handleSortChange}>
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
                  }}
                  aria-label="Sort Order"
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
          <FormControlLabel
            control={
              <Tooltip title="Show only releases" arrow>
                <Checkbox
                  checked={stage == 'prod'}
                  onChange={(event) => {
                    setStage(event.target.checked ? 'prod' : 'latest');
                    setCatalogEntries([]);
                    setSearchClicked(true);
                  }}
                  name="onlyReleases"
                  color="primary"
                />
              </Tooltip>
            }
            label="Releases"
          />
        </Box>
      </AppBar>
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          <Grid container xs={12} spacing={4}>
            {catalogEntries.map((entry) => {
              let releasedStr = '';
              if (entry.repo.catalog?.prod) {
                releasedStr = `Released ${getRelativeTimeString(entry.repo.catalog.prod.released)}`;
              } else if (entry.repo.catalog?.preprod) {
                releasedStr = `Pre-Released ${getRelativeTimeString(entry.repo.catalog.preprod.released)}`;
              } else {
                releasedStr = `${entry.ref_type == 'branch' ? 'Last updated' : 'Released'} ${getRelativeTimeString(entry.released)}`;
              }
              return (
                <Grid xs={6} lg={3} key={entry.id}>
                  <Item sx={styles[entry.language_direction]}>
                    <Box id="category-a" sx={{ fontSize: '12px', textAlign: 'center' }}>
                      <a
                        key="title"
                        style={{ textDecoration: 'none', fontSize: '1.3em' }}
                        href={`/u/${entry.full_name}/${
                          (stage == 'prod' && entry.repo?.catalog?.prod?.branch_or_tag_name) || entry.repo?.catalog?.latest?.branch_or_tag_name || 'master'
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {entry.title}
                      </a>{' '}
                      ({entry.abbreviation})
                      <div key="stages">
                        {Object.keys(entry.repo?.catalog || { latest: { branch_or_tag_name: entry.branch_or_tag_name } })
                          .filter((st) => entry.repo.catalog[st] && (stage != 'prod' || st == stage))
                          .map((st) => entry.repo.catalog[st])
                          .map((c, i) => (
                            <span key={c.branch_or_tag_name}>
                              {i == 0 ? '' : ', '}
                              <a
                                style={{ textDecoration: 'none' }}
                                key={c.branch_or_tag_name}
                                href={`/u/${entry.full_name}/${c.branch_or_tag_name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {c.branch_or_tag_name}
                              </a>
                            </span>
                          ))}
                      </div>
                    </Box>
                    <Box component="div" aria-labelledby="category-a" sx={{ pl: 2 }}>
                      <div key="lang">
                        <a style={styles.filterLink} href={`?lang=${entry.language}`}>
                          {entry.language_title} ({entry.language})
                        </a>
                      </div>
                      <div key="owner">
                        <a style={styles.filterLink} href={`?owner=${encodeURI(entry.owner)}`}>
                          {entry.owner}
                        </a>
                      </div>
                      <div key="subject">
                        <a style={styles.filterLink} href={`?subject=${encodeURI(entry.subject)}`}>
                          {entry.subject}
                        </a>
                      </div>
                      <div key="release" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                        {releasedStr}
                      </div>
                    </Box>
                  </Item>
                </Grid>
              );
            })}
          </Grid>
        </Grid>
      </Box>
      {error && (
        <Typography id="error" sx={{ textAlign: 'center', color: 'red' }}>
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
