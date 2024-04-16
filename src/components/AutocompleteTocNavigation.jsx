import { useState, useEffect } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import PropTypes from 'prop-types';

export default function AutocompleteTocNavigation({ tocSections, value, onChange, sx }) {
  const [tocOptions, setTocOptions] = useState([]);

  useEffect(() => {
    const convertToTocOptions = async () => {
      const toOptions = (section, depth = 0, parentId = null) => {
        let { link, title, sections = [] } = section;
        const children = sections.flatMap((child) => toOptions(child, depth + 1, link));
        const option = {
          link,
          title,
          depth,
          parentId,
          matchTerms: [title].concat(children.map((obj) => obj.title)),
        };
        return [option].concat(children);
      };

      setTocOptions(tocSections.flatMap((section) => toOptions(section)));
    };

    if (tocSections) {
      convertToTocOptions();
    }
  }, [tocSections]);

  return (
    <Autocomplete
      options={tocOptions}
      getOptionLabel={(option) => option.title}
      sx={{ ...sx, paddingRight: '10px' }}
      value={value}
      isOptionEqualToValue={(option, value) => option.link === value.link}
      onChange={onChange}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.link + option.title}>
            {'\u00A0'.repeat(option.depth * 4)}
            <div key={option.link + '-div'}>{option.title}</div>
          </li>
        );
      }}
      renderInput={(params) => <TextField {...params} label="Table of Contents" />}
    />
  );
}

AutocompleteTocNavigation.propTypes = {
  tocSections: PropTypes.array.isRequired,
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  sx: PropTypes.object,
};
