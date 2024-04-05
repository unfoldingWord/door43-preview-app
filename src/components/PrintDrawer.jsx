import { useState, useEffect, useContext } from "react";
import { styled } from "@mui/material/styles";
import { LinearProgress } from "@mui/material";
import {
  Box,
  IconButton,
  Button,
  Grid,
  Option,
  Input,
  Select,
  Drawer,
  Typography,
  Tooltip,
} from "@mui/joy";
import Divider from "@mui/material/Divider";
import PrintIcon from "@mui/icons-material/Print";
import PdfIcon from "@mui/icons-material/PictureAsPdf";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PropTypes from "prop-types";
import printResources from "../lib/printResources";
import ColumnsSelector from "./ColumnsSelector";
import PageSizeSelector from "./PageSizeSelector";
import PageOrientationSelector from "./PageOrientationSelector";
import { AppContext } from "./App.context";

const defaultIncludeNames = [
  "titles",
  "headings",
  "introductions",
  "footnotes",
  "xrefs",
  "paraStyles",
  "characterMarkup",
  "chapterLabels",
  "versesLabels",
];

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: "flex-start",
}));

export default function PrintDrawer({
  openPrintDrawer,
  onClosePrintDrawer,
  handlePrint,
}) {
  const {
    state: {
      printOptions,
      canChangeColumns,
      printPreviewStatus,
      printPreviewPercentDone,
    },
    actions: { setPrintOptions },
  } = useContext(AppContext);

  const [pageOrientation, setPageOrientation] = useState("P");
  const [pageSize, setPageSize] = useState("A4");

  const allNames = [
    "wordAtts",
    "titles",
    "headings",
    "introductions",
    "footnotes",
    "xrefs",
    "paraStyles",
    "characterMarkup",
    "chapterLabels",
    "versesLabels",
  ];

  const getStyles = (name) => {
    return {
      fontWeight:
        printOptions.includedNames?.indexOf(name) === -1 ? "normal" : "bold",
    };
  };

  const handleIncludedChange = (event, value) => {
    if (event) {
      setPrintOptions((prev) => ({
        ...prev,
        includedNames: typeof value === "string" ? value.split(",") : value,
      }));
    }
  };

  useEffect(() => {
    // Reset to A4 whenever orientation changes
    setPageSize("A4");
  }, [pageOrientation]);

  useEffect(() => {
    if (
      pageOrientation &&
      pageSize &&
      printResources.pageSizes[pageOrientation]?.[pageSize]?.width
    ) {
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
      <Drawer
        anchor="right"
        open={openPrintDrawer}
        onClose={onClosePrintDrawer}
      >
        <DrawerHeader>
          <IconButton onClick={onClosePrintDrawer}>
            <ChevronRightIcon />
          </IconButton>
          <Typography variant="h4" sx={{ textAlign: "center" }}>
            Page Format
          </Typography>
        </DrawerHeader>
        <Divider />
        <Box>
          <Grid container sx={{ display: "flex", flexDirection: "column" }}>
            {true && (
              <Grid sx={{ margin: "4%" }}>
                <form
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}
                >
                  <Typography
                    id="included-content-group-label"
                    sx={{ marginRight: "5%", marginTop: "2%" }}
                  >
                    Included Content
                  </Typography>
                  <Select
                    id="included-content"
                    multiple
                    value={allNames}
                    onChange={handleIncludedChange}
                    input={<Input label="Name" variant="outlined" />}
                    sx={{ width: 450 }}
                  >
                    {allNames.map((name) => (
                      <Option key={name} value={name} style={getStyles(name)}>
                        {name}
                      </Option>
                    ))}
                  </Select>
                </form>
              </Grid>
            )}
            <Grid sx={{ margin: "4%" }}>
              <PageOrientationSelector
                formLabelTitle={"Page Orientation"}
                pageOrientation={pageOrientation}
                setPageOrientation={setPageOrientation}
              />
            </Grid>
            <Grid sx={{ margin: "4%" }}>
              <PageSizeSelector
                formLabelTitle={"Page Size"}
                pageSizes={printResources.pageSizes[pageOrientation]}
                pageSize={pageSize}
                setPageSize={setPageSize}
                setPrintOptions={setPrintOptions}
              />
            </Grid>
            {canChangeColumns && (
              <Grid sx={{ margin: "4%" }}>
                <ColumnsSelector
                  formLabelTitle={"Columns"}
                  listItems={columnsList}
                  columns={printOptions.columns}
                  setPrintOptions={setPrintOptions}
                />
              </Grid>
            )}
          </Grid>
          <Tooltip
            title={
              printPreviewStatus == "ready"
                ? "Save as PDF"
                : "Print Preview Still Rendering"
            }
            arrow
          >
            <Button
              sx={{
                margin: "4%",
                backgroundColor:
                  printPreviewStatus == "ready" ? "auto" : "#808080",
                "&:hover": {
                  backgroundColor:
                    printPreviewStatus == "ready" ? "green" : "#404040",
                },
              }}
              onClick={() => {
                alert("Be sure to select 'Save as PDF' in the print dialog box.");
                handlePrint();
              }}
            >
              <PdfIcon sx={{ fontSize: 40 }} />
              <LinearProgress
                color="secondary"
                variant="determinate"
                value={printPreviewPercentDone}
                sx={{
                  position: "absolute",
                  top: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0.4,
                  borderRadius: 4,
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "green",
                  },
                }}
              />
            </Button>
          </Tooltip>
          <Tooltip
            title={
              printPreviewStatus == "ready"
                ? "Print"
                : "Print Preview Still Rendering"
            }
            arrow
          >
            <Button
              sx={{
                margin: "4%",
                backgroundColor:
                  printPreviewStatus == "ready" ? "auto" : "#808080",
                "&:hover": {
                  backgroundColor:
                    printPreviewStatus == "ready" ? "green" : "#404040",
                },
              }}
              onClick={handlePrint}
            >
              <PrintIcon sx={{ fontSize: 40 }} />
              <LinearProgress
                color="secondary"
                variant="determinate"
                value={printPreviewPercentDone}
                sx={{
                  position: "absolute",
                  top: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0.4,
                  borderRadius: 4,
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "green",
                  },
                }}
              />
            </Button>
          </Tooltip>
          <div style={{ padding: "10px" }}>
            {printPreviewPercentDone < 100
              ? `Preparing Print Preview: ${printPreviewPercentDone}%`
              : "Ready to Print or Save as PDF"}
          </div>
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
