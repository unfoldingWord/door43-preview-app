// React libraries
import { AppBar, Toolbar, Fab } from '@mui/material';
import PropTypes from 'prop-types';

// Material UI libraries
import PrintIcon from '@mui/icons-material/Print';

// Components
import BibleReference from 'bible-reference-rcl';

export default function BibleReferencePrintBar({ bibleReferenceState, bibleReferenceActions, printEnabled, onPrintClick }) {
  return (
    <AppBar position="relative" sx={{ backgroundColor: 'white', position: 'sticky', top: '0' }}>
      <Toolbar
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          overflowX: 'scroll',
          paddingTop: '10px',
          paddingBottom: '10px',
        }}
      >
        <div>&nbsp;</div>
        <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} />
        <Fab color="primary" aria-label="open" variant="extended" disabled={!printEnabled} onClick={onPrintClick}>
          <PrintIcon />
        </Fab>
      </Toolbar>
    </AppBar>
  );
}

BibleReferencePrintBar.propTypes = {
  bibleReferenceState: PropTypes.object.isRequired,
  bibleReferenceActions: PropTypes.object.isRequired,
  printEnabled: PropTypes.bool,
  onPrintClick: PropTypes.func.isRequired,
};
