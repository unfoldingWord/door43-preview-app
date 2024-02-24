import React from 'react';
import PropTypes from 'prop-types'
import { Typography, Select, Option } from '@mui/joy'

export default function ColumnsSelector({
  formLabelTitle,
  listItems,
  setPrintOptions,
}) {
  return (
    <>
      <form
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}
      >
        <Typography
          id="page-size-group-label"
          sx={{ marginRight: '5%', marginTop: '1%' }}
        >
          {formLabelTitle}
        </Typography>
        <Select
          aria-labelledby="page-size-group-label"
          name="page-size-buttons-group"
          defaultValue={listItems ? listItems[0] : "1"}
          size="small"
          sx={{ width: '70px' }}
          color="primary"
          onChange={(e, value) => setPrintOptions(prev => ({...prev, columns: value}))}
        >
          {listItems.map((nc, n) => (
            <Option
              key={n}
              value={nc}
            >
              {nc}
            </Option>
          ))}
        </Select>
      </form>
    </>
  );
}

ColumnsSelector.propTypes = {
  formLabelTitle: PropTypes.string,
  listItems: PropTypes.any,
  setFormatData: PropTypes.func,
};

