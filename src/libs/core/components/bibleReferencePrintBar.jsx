import PropTypes from "prop-types";
import { AppBar, Toolbar, Fab, Box } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import BibleReference from "bible-reference-rcl";

export default function BibleReferencePrintBar({
    bibleReferenceState,
    bibleReferenceActions,
    printEnabled,
    onPrintClick,
}) {
    return (
        <AppBar
          position="relative"
          sx={{ backgroundColor: "white", position: "sticky", top: "0" }}
        >
          <Toolbar sx={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                overflowX: "scroll",
          }}>
            <div>&nbsp;</div>
            <BibleReference
                status={bibleReferenceState}
                actions={bibleReferenceActions}
            />
            <Fab
              color="primary"
              aria-label="open"
              variant="extended"
              disabled={!printEnabled}
              onClick={onPrintClick}
            >
              <PrintIcon
                sx={{
                  extendedIcon: { marginRight: (theme) => theme.spacing(1) },
                }}
              />
              <Box sx={{ display: { xs: 'none', md: 'block' } }} >Print</Box>
            </Fab>
          </Toolbar>
        </AppBar>)
}

BibleReferencePrintBar.propTypes = {
    bibleReferenceState: PropTypes.object.isRequired,
    bibleReferenceActions: PropTypes.object.isRequired,
    printEnabled: PropTypes.bool,
    onPrintClick: PropTypes.func.isRequired,
  };
  