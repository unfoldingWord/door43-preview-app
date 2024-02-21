import React from 'react'
import PropTypes from 'prop-types'
import { Typography, Option, Select } from '@mui/joy'

export default function PageSizeSelector({
  formLabelTitle,
  pageSizes,
  pageSize,
  setPageSize,
}) {
  // console.log("PAGE SIZES", pageSizes)
  return (
    <>
      <form>
        <Typography
          id="page-size-group-label"
          sx={{ marginRight: '5%', marginTop: '1%' }}
        >
          {formLabelTitle}
        </Typography>
        <Select
          aria-labelledby="page-size-group-label"
          name="page-size-buttons-group"
          value={pageSize}
          style={{ width: '100px' }}
          color="primary"
          onChange={(e, value) => setPageSize(value)}
        >
          {Object.entries(pageSizes).map((pf, n) => {
            // console.log("PF", pf[0], pf[1].label, n)
            return (<Option
              key={n}
              value={pf[0]}
            >
              {pf[1].label}
            </Option>
          )})}
        </Select>
      </form>
    </>
  );
}

PageSizeSelector.propTypes = {
  formLabelTitle: PropTypes.string,
  pageSizes: PropTypes.any,
  pageSize: PropTypes.string,
  setPageSize: PropTypes.func,
  setPrintOptions: PropTypes.func,
};