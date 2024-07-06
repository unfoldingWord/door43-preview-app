// React imports
import { useEffect, useState, useContext } from 'react';

// Material UI imports
import {
  Box,
  Grid,
  Button,
} from '@mui/material';
import CircularProgress from '@mui/joy/CircularProgress';

// Components
import CatalogEntriesGrid from './CatalogEntriesGrid';

// Context imports
import { AppContext } from '@contexts/App.context';

// Constants
import { API_PATH } from '@common/constants';

const DEFAULT_LIMIT = 50;

export const ResourcesCardGrid = ({languages = [], owners = [], subjects = [], stage = "prod", setIsFetchingEntries = () => {}, setErrorMessage = () => {}, sort = "lang", order = "asc"}) => {
  const {
    state: { serverInfo },
  } = useContext(AppContext);

  const [catalogEntries, setCatalogEntries] = useState([]);
  const [gotAllEntries, setGotAllEntries] = useState(false);
  const [page, setPage] = useState(0);
  const [loadMoreClicked, setLoadMoreClicked] = useState(false);

  useEffect(() => {
    const fetchCatalogEntries = async () => {
      let p = page;
      let params = new URLSearchParams();
      owners.forEach((o) => params.append('owner', o));
      languages.forEach((l) => params.append('lang', l));
      subjects.forEach((s) => params.append('subject', s));
      params.append('stage', stage);
      params.append('sort', sort);
      params.append('order', order);

      p = page + 1;
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
            setErrorMessage('No projects found meeting this search criteria');
          } else {
            setCatalogEntries((prevState) => [...prevState, ...data]);
            if (data.length < DEFAULT_LIMIT) {
              setGotAllEntries(true);
            }
          }
        })
        .catch((e) => {
          console.log('Error fetching catalog entries:', e);
          setErrorMessage('Failed to fetch projects from DCS');
        })
        .finally(() => {
          setIsFetchingEntries(false);
        });
    };

    if (serverInfo?.baseUrl && loadMoreClicked && !isFetchingEntries) {
      setError();
      setIsFetchingEntries(true);
      fetchCatalogEntries();
    }
  }, [serverInfo, searchClicked, isFetchingEntries, loadMoreClicked, languages, owners, subjects, order, page, sort, stage]);

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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
        <Button onClick={() => setLoadMoreClicked(true)} disabled={loadMoreClicked} style={{ textAlign: 'center', fontWeight: "bold" }}>
          Load more...
        </Button>
      </div>
    </Grid>);
  } else if (loadMoreClicked || searchClicked) {
    extraItem = (
    <Grid item xs={12} sm={6} md={4} lg={3} key="load-more" alignItems="stretch">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', justifyContent: 'center', textAlign: 'center'}}>
        <CircularProgress style={{textAlign: 'center', width: '100%'}} />
      </div>
    </Grid>);
  }

  return (
    <>
      <Box sx={{ flexGrow: 1, margin: "30px" }}>
        <Grid container spacing={2}>
          <CatalogEntriesGrid catalogEntries={catalogEntries} stage={stage} extraItem={extraItem} />
        </Grid>
      </Box>
    </>
  );
};

export default ResourcesCardGrid;