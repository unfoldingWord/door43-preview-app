import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// MUI components
import { AppBar, Toolbar, Tooltip, IconButton, SvgIcon, Collapse, Box, Grid, Tab, Typography } from '@mui/material';

// MUI icons
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// Custom components
import CatalogEntriesGrid from './CatalogEntriesGrid';

// Constants
import { APP_NAME, APP_VERSION } from '@common/constants';

const sx = {
  title: {
    flexGrow: 1,
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: "center",
  },
  subtitle: {
    flexGrow: 1,
    color: '#ffffff',
    fontSize: '14px',
    textAlign: "center",
    // fontStyle: "italic",
    textDecoration: "none",
  },
  headerIcon: {
    color: '#ffffff',
    textAlign: "center",
  },
  extendedIcon: {
    marginRight: (theme) => theme.spacing(1),
  },
};

export default function Header({ serverInfo, urlInfo, repo, owner, catalogEntry, builtWith, bookId, bookTitle, onOpenClick }) {
  const [isSubAppBarOpen, setSubAppBarOpen] = useState(false);
  const [dcsRefUrl, setDcsRefUrl] = useState('');

  const handleSubAppBarToggle = () => {
    setSubAppBarOpen(!isSubAppBarOpen);
  };

  const handleViewClick = () => {
    if (dcsRefUrl) window.open(dcsRefUrl, '_blank', 'noreferrer');
  };

  useEffect(() => {
    let url = serverInfo?.baseUrl;
    if (serverInfo?.baseUrl && urlInfo) {
      if (urlInfo.owner && urlInfo.repo) {
        url = `${serverInfo.baseUrl}/${urlInfo.owner}/${urlInfo.repo}`;
        if (catalogEntry) {
          url += `/src/${catalogEntry.ref_type}/${catalogEntry.branch_or_tag_name}`;
        } else {
          url += `/src/branch/${urlInfo.ref || 'master'}`;
        }
      } else if (urlInfo?.owner) {
        url = `${serverInfo.baseUrl}/${urlInfo?.owner}`
      }
    }
    setDcsRefUrl(url)
  }, [urlInfo, catalogEntry, serverInfo]);

  return (
    <header>
      <AppBar position="relative">
        <Box display="flex" flexDirection="column">
          <Toolbar
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              '& > div': {
                flex: '1 1 auto',  // Reset the flex property
              },
              '& > div:first-of-type': {
                flex: '1 1 25%',  // The first cell takes up 15% of the toolbar
              },
              '& > div:nth-of-type(2)': {
                flex: '1 1 50%',  // The second cell takes up 70% of the toolbar
              },
              '& > div:last-child': {
                flex: '1 1 25%',  // The third cell takes up 15% of the toolbar
              },
              button: {
                flex: 'none',
              },
            }}
          >
            <div style={{textAlign: "center"}}>
              <Tooltip title="Go to DCS" arrow>
                <IconButton sx={sx.headerIcon} onClick={handleViewClick} size={'large'}>
                  <SvgIcon fontSize={'large'}>
                    <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M256 500C390.757 500 500 390.757 500 256C500 121.243 390.757 12 256 12C121.243 12 12 121.243 12 256C12 390.757 121.243 500 256 500Z"
                        fill="#AAC906"
                        stroke="#1E1E1E"
                        strokeWidth="24"
                        strokeMiterlimit="10"
                        strokeLinejoin="bevel"
                      />
                      <rect x="73" y="145" width="366" height="221.662" rx="110.831" fill="#1E1E1E" />
                      <path
                        d="M137.585 295.96V221.157H172.315C178.371 221.157 183.856 222.119 188.772 224.043C193.688 225.895 197.891 228.531 201.382 231.95C204.944 235.37 207.651 239.359 209.503 243.919C211.355 248.407 212.282 253.287 212.282 258.559C212.282 263.902 211.355 268.853 209.503 273.412C207.651 277.972 204.944 281.926 201.382 285.274C197.891 288.622 193.688 291.258 188.772 293.182C183.856 295.034 178.371 295.96 172.315 295.96H137.585ZM155.752 283.564L153.294 279.931H171.781C175.343 279.931 178.478 279.397 181.185 278.328C183.892 277.188 186.136 275.657 187.917 273.733C189.769 271.81 191.194 269.565 192.192 267.001C193.189 264.436 193.688 261.622 193.688 258.559C193.688 255.567 193.189 252.788 192.192 250.224C191.194 247.588 189.769 245.308 187.917 243.384C186.136 241.461 183.892 239.965 181.185 238.896C178.478 237.756 175.343 237.186 171.781 237.186H152.973L155.752 233.767V283.564Z"
                        fill="white"
                      />
                      <path
                        d="M263.734 297.029C257.821 297.029 252.299 296.103 247.17 294.25C242.112 292.327 237.659 289.655 233.812 286.236C230.037 282.816 227.116 278.756 225.05 274.054C222.984 269.281 221.951 264.009 221.951 258.238C221.951 252.61 223.019 247.445 225.157 242.743C227.365 238.041 230.357 233.981 234.133 230.561C237.909 227.142 242.361 224.47 247.491 222.546C252.62 220.623 258.141 219.661 264.054 219.661C268.115 219.661 272.033 220.16 275.809 221.157C279.656 222.155 283.218 223.544 286.495 225.325C289.772 227.106 292.55 229.136 294.83 231.416L284.037 244.881C282.327 243.242 280.475 241.817 278.48 240.606C276.486 239.324 274.242 238.326 271.748 237.614C269.255 236.83 266.512 236.438 263.52 236.438C260.599 236.438 257.749 236.937 254.971 237.935C252.193 238.932 249.735 240.392 247.597 242.316C245.46 244.168 243.75 246.483 242.468 249.262C241.257 251.969 240.652 255.032 240.652 258.452C240.652 261.871 241.293 264.935 242.575 267.642C243.857 270.349 245.603 272.664 247.811 274.588C250.091 276.44 252.727 277.865 255.719 278.862C258.711 279.86 261.953 280.358 265.443 280.358C268.507 280.358 271.285 279.931 273.779 279.076C276.272 278.221 278.516 277.188 280.511 275.977C282.506 274.695 284.287 273.341 285.854 271.916L294.51 285.915C292.586 287.768 290.021 289.549 286.816 291.258C283.61 292.968 280.012 294.357 276.023 295.426C272.033 296.495 267.937 297.029 263.734 297.029Z"
                        fill="white"
                      />
                      <path
                        d="M336.018 297.029C330.603 297.029 325.688 296.459 321.271 295.319C316.925 294.179 313.007 292.576 309.516 290.51C306.097 288.373 302.962 285.88 300.112 283.03L310.05 269.779C314.539 274.267 319.027 277.402 323.515 279.183C328.074 280.893 332.598 281.748 337.086 281.748C339.152 281.748 341.147 281.534 343.071 281.106C345.065 280.608 346.668 279.824 347.879 278.756C349.09 277.687 349.696 276.298 349.696 274.588C349.696 273.448 349.375 272.486 348.734 271.703C348.093 270.848 347.203 270.135 346.063 269.565C344.923 268.996 343.569 268.497 342.002 268.069C340.506 267.642 338.903 267.286 337.193 267.001C335.555 266.645 333.809 266.324 331.957 266.039C327.469 265.327 323.479 264.329 319.989 263.047C316.569 261.765 313.684 260.162 311.333 258.238C308.982 256.315 307.165 254.071 305.883 251.506C304.672 248.941 304.066 246.02 304.066 242.743C304.066 239.252 304.885 236.082 306.524 233.233C308.234 230.312 310.549 227.854 313.47 225.859C316.391 223.793 319.775 222.226 323.622 221.157C327.469 220.017 331.53 219.448 335.804 219.448C340.933 219.448 345.386 219.946 349.162 220.944C353.009 221.941 356.357 223.366 359.207 225.218C362.056 226.999 364.443 229.101 366.366 231.523L356.215 243.064C354.433 241.283 352.439 239.787 350.23 238.576C348.022 237.365 345.671 236.438 343.177 235.797C340.755 235.156 338.297 234.836 335.804 234.836C333.311 234.836 331.102 235.121 329.179 235.69C327.255 236.189 325.723 236.937 324.584 237.935C323.444 238.932 322.874 240.179 322.874 241.675C322.874 242.957 323.337 244.061 324.263 244.987C325.189 245.842 326.4 246.59 327.896 247.231C329.464 247.873 331.209 248.407 333.132 248.834C335.056 249.191 336.979 249.511 338.903 249.796C342.964 250.437 346.775 251.292 350.337 252.361C353.899 253.358 357.034 254.712 359.741 256.422C362.448 258.06 364.55 260.197 366.046 262.833C367.613 265.398 368.397 268.604 368.397 272.451C368.397 277.651 366.972 282.104 364.122 285.808C361.344 289.442 357.532 292.22 352.688 294.144C347.844 296.067 342.287 297.029 336.018 297.029Z"
                        fill="white"
                      />
                    </svg>
                  </SvgIcon>
                </IconButton>
              </Tooltip>
              <div style={{display: "inline-block", verticalAlign: "middle"}}>
              <div style={{ ...sx.title, display: 'block' }}>
                <a href={'/'} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {APP_NAME}
                </a>
              </div>
              {urlInfo?.owner && (<div style={{ ...sx.subtitle, display: 'block' }}>
                <a href={`/u/${owner?.username || urlInfo.owner}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {owner?.full_name || owner?.username || urlInfo.owner}
                </a>
              </div>)}
              </div>
            </div>
            <div>
              {urlInfo?.owner && urlInfo?.repo && (
                <>
                  <Typography sx={{...sx.title, direction: catalogEntry?.language_direction || 'ltr'}}>
                    {repo ? `${repo.title} (${repo.abbreviation})` : urlInfo?.repo}{bookTitle && ` :: ${bookTitle} (${bookId})`}
                  </Typography>
                  <Typography sx={{textAlign: "center"}}>
                    <a style={sx.subtitle} href={dcsRefUrl} target="_blank" rel="noopener noreferrer">
                      <Tooltip title="View on DCS" arrow>
                        <span>{urlInfo.owner}/{urlInfo.repo}</span>
                      </Tooltip>
                      <Tooltip title={`${catalogEntry?.ref_type === "branch" ? "Updated" : "Released"}: ${catalogEntry?.released}${catalogEntry?.ref_type === "branch" ? ` (${catalogEntry.commit_sha.substring(0, 8)})` : ''}`}>
                        <span>{' '}({catalogEntry?.branch_or_tag_name || urlInfo.ref  || repo?.default_branch || "master"})</span>
                      </Tooltip>
                    </a>
                    {repo?.language && (<>
                      {' :: '}
                      <Tooltip title="See other resources in this language" arrow>
                        <a style={sx.subtitle} href={`/${repo.language}`}>{repo.language_title} ({repo.language})</a>
                      </Tooltip>
                    </>)}
                  </Typography>
                </>
              )}
            </div>
            <div style={{textAlign: "right"}}>
            <Tooltip title="Search for a project" arrow>
              <IconButton sx={sx.headerIcon} onClick={onOpenClick}>
                <ZoomInIcon sx={sx.extendedIcon} />
              </IconButton>
            </Tooltip>
            </div>
          </Toolbar>
          <Box
            sx={{
              width: '100%',
              textAlign: 'center',
              height: '20px',
            }}
          >
            <Tooltip title={builtWith.length ? "Show app and resource versions" : "Show app info"} arrow>
              <Tab
                label={isSubAppBarOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={handleSubAppBarToggle}
                sx={{
                  paddingTop: '20px !important',
                  minHeight: 'auto', // Reduce the height
                  padding: '6px 12px', // Adjust the padding as needed
                  justifyContent: 'center', // Center the icon
                  backgroundColor: 'rgb(25, 118, 210)',
                  borderBottomLeftRadius: '10px',
                  borderBottomRightRadius: '10px',
                  height: '25px',
                }}
              />
            </Tooltip>
          </Box>
        </Box>
        <Collapse in={isSubAppBarOpen}>
          <AppBar position="static" sx={{ backgroundColor: 'lightgrey', padding: '10px', color: 'black' }}>
            {(builtWith.length || catalogEntry) && (<>
              <div style={{paddingBottom: "10px"}}>
                <div id="built-with">
                  <Typography style={{fontWeight: "bold", paddingBottom: "10px"}}>Built with:</Typography>
                </div>
                <Box sx={{ flexGrow: 1 }}>
                  <Grid container>
                    <CatalogEntriesGrid catalogEntries={builtWith.length ? builtWith : [catalogEntry]} showJustThisCatalogEntry={true} linkToDCS={true} bookId={bookId} />
                  </Grid>
                </Box>
              </div>
            </>)}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div id="server-info">
                Server:{' '}
                <a href={dcsRefUrl || serverInfo?.baseUrl} target="_blank" rel="noopener noreferrer">
                  {serverInfo?.baseUrl}
                </a>{' '}
                ({serverInfo?.ID})
              </div>
              {catalogEntry &&
              <div style={{textAlign: "center"}}>
                <a href={catalogEntry.metadata_url} target="_blank" rel="noopener noreferrer">
                  {"See resource's metadata"}
                </a>
              </div>}
              <div id="app-version"><a href="https://github.com/unfoldingWord/door43-preview-app/releases/latest" target="_blank" rel="noopener noreferrer" style={{textDecoration: "none"}}>App Version: v{APP_VERSION}</a></div>
            </div>
          </AppBar>
        </Collapse>
      </AppBar>
    </header>
  );
}

Header.propTypes = {
  ready: PropTypes.bool,
  onPrintClick: PropTypes.func,
  onOpenClick: PropTypes.func,
  serverInfo: PropTypes.object,
  repo: PropTypes.object,
  owner: PropTypes.object,
  catalogEntry: PropTypes.object,
  builtWith: PropTypes.arrayOf(PropTypes.object),
  bookId: PropTypes.string,
  bookTitle: PropTypes.string,
  urlInfo: PropTypes.object,
};
