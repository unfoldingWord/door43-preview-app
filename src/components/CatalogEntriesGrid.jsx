import React from 'react';
import PropTypes from 'prop-types';
import { getRelativeTimeString } from '@helpers/datetime';
import { styled } from '@mui/material/styles';
import LaunchIcon from '@mui/icons-material/Launch';
import { Box, Tooltip, Paper, Unstable_Grid2 as Grid } from '@mui/material';

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

const stageLevel = {
  prod: 0,
  preprod: 1,
  latest: 2,
};

const subjectsUsingBooks = ['Aligned Bible', 'Bible', 'Greek New Testament', 'Hebrew Old Testament', 'Translation Notes', 'TSV Translation Notes', 'Translation Questions', 'TSV Translation Questions', 'TSV Translation Words Links'];

const CatalogEntriesGrid = ({ catalogEntries, stage = 'latest', showJustThisCatalogEntry = false, linkToDCS = false, bookId = '' }) => {
  return (
    <Grid container xs={12} spacing={1}>
      {catalogEntries.map((entry) => {
        let releasedStr = '';
        if (showJustThisCatalogEntry) {
          releasedStr = `${entry.ref_type === 'tag' ? 'Released' : 'Updated'} ${getRelativeTimeString(entry.released)}`;
        } else if (entry.repo.catalog?.prod) {
          releasedStr = `Released ${getRelativeTimeString(entry.repo.catalog.prod.released)}`;
        } else if (entry.repo.catalog?.preprod) {
          releasedStr = `Pre-Released ${getRelativeTimeString(entry.repo.catalog.preprod.released)}`;
        } else {
          releasedStr = `${entry.ref_type == 'branch' ? 'Last updated' : 'Released'} ${getRelativeTimeString(entry.released)}`;
        }

        entry.dcs_url = `${entry.zipball_url.replace(/\/archive\/.*$/, '')}/src/${entry.ref_type}/${entry.branch_or_tag_name}`;

        const entriesToShow = [];
        if (showJustThisCatalogEntry) {
          entriesToShow.push(entry);
        } else {
          if (!(stage in stageLevel)) {
            stage = entry.stage;
          }
          for (let s of Object.keys(entry.repo?.catalog || { [entry.stage]: entry })) {
            if (s in stageLevel && stage in stageLevel && entry.repo.catalog[s] && stageLevel[s] <= stageLevel[stage]) {
              const e = entry.repo.catalog[s];
              e.stage = s;
              e.dcs_url = `${e.zipball_url.replace(/\/archive\/.*$/, '')}/src/${e.ref_type}/${e.branch_or_tag_name}`;
              entriesToShow.push(entry.repo.catalog[s]);
            }
          }
          if (!entriesToShow.length) {
            entriesToShow.push(entry);
          }
        }
        return (
          <Grid xs={6} lg={3} key={entry.id}>
            <Item sx={styles[entry.language_direction]}>
              <Box id="category-a" sx={{ fontSize: '12px', textAlign: 'center' }}>
                <a
                  key="title"
                  style={{ textDecoration: 'none', fontSize: '1.3em' }}
                  href={`/u/${entry.full_name}/${entriesToShow[0].branch_or_tag_name}${subjectsUsingBooks.includes(entry.subject) ? `#${bookId}` : ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {entry.title}
                </a>{' '}
                ({entry.abbreviation})
                <div key="stages">
                  {entriesToShow.map((e, i) => (
                    <span key={e.branch_or_tag_name}>
                      {i == 0 ? '' : ', '}
                      <a
                        style={{ textDecoration: 'none' }}
                        key={e.branch_or_tag_name}
                        href={linkToDCS ? e.dcs_url : `/u/${entry.full_name}/${e.branch_or_tag_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {e.branch_or_tag_name}
                        {e.ref_type == "branch" && showJustThisCatalogEntry && ` (${e.commit_sha.substring(0, 8)})`}
                      </a>
                      {linkToDCS && (
                        <Tooltip title={'View on DCS'} arrow>
                          <a href={e.dcs_url} target="_blank" rel="noopener noreferrer">
                            <LaunchIcon fontSize="x-small" />
                          </a>
                        </Tooltip>
                      )}
                    </span>
                  ))}
                </div>
              </Box>
              <Box component="div" aria-labelledby="category-a" sx={{ pl: 2 }}>
                <div key="lang">
                  <Tooltip title="Language" style={{ display: 'block' }} arrow>
                    <a style={styles.filterLink} href={`/${entry.language}`}>
                      {entry.language_title} ({entry.language})
                    </a>
                  </Tooltip>
                </div>
                <div key="owner">
                  <Tooltip title="Owner" arrow>
                    <a style={styles.filterLink} href={`/u/${encodeURI(entry.owner)}`}>
                      {entry.owner}
                    </a>
                  </Tooltip>
                </div>
                <div key="subject">
                  <Tooltip key="subject" title="Subject" arrow>
                    <a style={styles.filterLink} href={`/?subject=${encodeURI(entry.subject)}`}>
                      {entry.subject}
                    </a>
                  </Tooltip>
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
  );
};

CatalogEntriesGrid.propTypes = {
  catalogEntries: PropTypes.arrayOf(PropTypes.object).isRequired,
  stage: PropTypes.string,
  showJustThisCatalogEntry: PropTypes.bool,
  linkToDCS: PropTypes.bool,
  bookId: PropTypes.string,
};

export default CatalogEntriesGrid;
