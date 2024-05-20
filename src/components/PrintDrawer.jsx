// React imports
import { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';

// Material UI imports
import { styled } from '@mui/material/styles';
import {LinearProgress} from '@mui/material';
import { Box, IconButton, Button, Grid, Option, Input, Select, Drawer, Typography, Tooltip, Divider } from '@mui/joy';
import PrintIcon from '@mui/icons-material/Print';
import PdfIcon from '@mui/icons-material/PictureAsPdf';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// Local component imports
import ColumnsSelector from '@components/ColumnsSelector';
import PageSizeSelector from '@components/PageSizeSelector';
import PageOrientationSelector from '@components/PageOrientationSelector';

// Context imports
import { AppContext } from '@components/App.context';

// Helper imports
import { getColorForProgressBar } from '@helpers/loading';
import printResources from '@helpers/printResources';

const defaultIncludeNames = ['titles', 'headings', 'introductions', 'footnotes', 'xrefs', 'paraStyles', 'characterMarkup', 'chapterLabels', 'versesLabels'];

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-start',
}));

export default function PrintDrawer({ openPrintDrawer, onClosePrintDrawer, handlePrint }) {
  const {
    state: { printOptions, canChangeColumns, printPreviewStatus, printPreviewPercentDone },
    actions: { setPrintOptions },
  } = useContext(AppContext);

  const [pageOrientation, setPageOrientation] = useState('P');
  const [pageSize, setPageSize] = useState('A4');

  const allNames = ['wordAtts', 'titles', 'headings', 'introductions', 'footnotes', 'xrefs', 'paraStyles', 'characterMarkup', 'chapterLabels', 'versesLabels'];

  const getStyles = (name) => {
    return {
      fontWeight: printOptions.includedNames?.indexOf(name) === -1 ? 'normal' : 'bold',
    };
  };

  const handleIncludedChange = (event, value) => {
    if (event) {
      setPrintOptions((prev) => ({
        ...prev,
        includedNames: typeof value === 'string' ? value.split(',') : value,
      }));
    }
  };

  useEffect(() => {
    // Reset to A4 whenever orientation changes
    setPageSize('A4');
  }, [pageOrientation]);

  useEffect(() => {
    if (pageOrientation && pageSize && printResources.pageSizes[pageOrientation]?.[pageSize]?.width) {
      setPrintOptions((prevState) => ({
        ...prevState,
        pageWidth: printResources.pageSizes[pageOrientation][pageSize].width,
        pageHeight: printResources.pageSizes[pageOrientation][pageSize].height,
      }));
    }
  }, [pageOrientation, pageSize, setPrintOptions]);

  const columnsList = [1, 2, 3];

  return (
    <>
      <Drawer anchor="right" open={openPrintDrawer} onClose={onClosePrintDrawer}>
        <DrawerHeader>
          <IconButton onClick={onClosePrintDrawer}>
            <ChevronRightIcon />
          </IconButton>
          <Typography variant="h4" sx={{ textAlign: 'center' }}>
            Page Format
          </Typography>
        </DrawerHeader>
        <Divider />
        <Box>
          <Grid container sx={{ display: 'flex', flexDirection: 'column' }}>
            {false /* TODO: We need to use this */ && (
              <Grid sx={{ margin: '4%' }}>
                <form
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                  }}
                >
                  <Typography id="included-content-group-label" sx={{ marginRight: '5%', marginTop: '2%' }}>
                    Included Content
                  </Typography>
                  <Select id="included-content" multiple value={allNames} onChange={handleIncludedChange} input={<Input label="Name" variant="outlined" />} sx={{ width: 450 }}>
                    {allNames.map((name) => (
                      <Option key={name} value={name} style={getStyles(name)}>
                        {name}
                      </Option>
                    ))}
                  </Select>
                </form>
              </Grid>
            )}
            <Grid sx={{ margin: '4%' }}>
              <PageOrientationSelector formLabelTitle={'Page Orientation'} pageOrientation={pageOrientation} setPageOrientation={setPageOrientation} />
            </Grid>
            <Grid sx={{ margin: '4%' }}>
              <PageSizeSelector
                formLabelTitle={'Page Size'}
                pageSizes={printResources.pageSizes[pageOrientation]}
                pageSize={pageSize}
                setPageSize={setPageSize}
                setPrintOptions={setPrintOptions}
              />
            </Grid>
            {canChangeColumns && (
              <Grid sx={{ margin: '4%' }}>
                <ColumnsSelector formLabelTitle={'Columns'} listItems={columnsList} columns={printOptions.columns} setPrintOptions={setPrintOptions} />
              </Grid>
            )}
          </Grid>
          <Tooltip title={printPreviewStatus == 'ready' ? 'Save as PDF' : `Preparing Print Preview: ${printPreviewPercentDone}%`} arrow>
            <Button
              sx={{
                margin: '5px',
                backgroundColor: '#808080',
                '&:hover': {
                  backgroundColor: '#404040',
                },
              }}
              onClick={() => {
                alert("Be sure to select 'Save as PDF' in the print dialog box.");
                handlePrint();
              }}
            >
              <PdfIcon sx={{ fontSize: 40 }} />
              <LinearProgress
                  variant="determinate"
                  value={printPreviewPercentDone}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0.5,
                    borderRadius: 1,
                    backgroundColor: 'grey',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: printPreviewPercentDone < 100 ? getColorForProgressBar(printPreviewPercentDone / 100) : 'green',
                    },
                  }}
                />
            </Button>
          </Tooltip>
          <Tooltip title={printPreviewStatus == 'ready' ? 'Print' : `Preparing Print Preview: ${printPreviewPercentDone}%`} arrow>
            <Button
              sx={{
                margin: '5px',
                backgroundColor: '#808080',
                '&:hover': {
                  backgroundColor: '#404040',
                },
              }}
              onClick={handlePrint}
            >
              <PrintIcon sx={{ fontSize: 40 }} />
              <LinearProgress
                  variant="determinate"
                  value={printPreviewPercentDone}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0.5,
                    borderRadius: 1,
                    backgroundColor: 'grey',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: printPreviewPercentDone < 100 ? getColorForProgressBar(printPreviewPercentDone / 100) : 'green',
                    },
                  }}
                />
            </Button>
          </Tooltip>
        </Box>
      </Drawer>
    </>
  );
}

PrintDrawer.propTypes = {
  /** PrintDrawer is open when this is set true */
  openPrintDrawer: PropTypes.bool,
  /** handle the needed actions, when modal is closed */
  onClosePrintDrawer: PropTypes.func,
  canChangeAtts: PropTypes.bool,
  canChangeColumns: PropTypes.bool,
  handlePrint: PropTypes.func,
};
