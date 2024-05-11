// React imports
import { useState, useEffect } from 'react';

// Prop-types import
import PropTypes from 'prop-types';

// Material UI imports
import { Autocomplete, TextField } from '@mui/material';

// Local component imports
import AutocompleteTocNavigation from './AutocompleteTocNavigation';

const findTocSection = (link, sections) => {
  if (!sections || !sections.length) {
    return null;
  }
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].link == link) {
      return sections[i];
    }
    const section = findTocSection(link, sections[i].sections);
    if (section) {
      return section;
    }
  }
};

export default function TwNavigation({ twManuals, anchor, setNavAnchor }) {
  const [selectedManual, setSelectedManual] = useState();
  const [selectedTocSection, setSelectedTocSection] = useState();

  const onTocSectionSelectionChange = (e, option) => {
    if (option && option.link) {
      const manualId = option.link.split('--')[0];
      if (!selectedManual || selectedManual.link != `${manualId}--${manualId}`) {
        for (let i = 0; i < twManuals.length; i++) {
          if (twManuals[i].link == `${manualId}--${manualId}`) {
            setSelectedManual(twManuals[i]);
            break;
          }
        }
      }
      setSelectedTocSection(option);
      setNavAnchor(option.link);
    }
  };

  const onManualSelectionChange = (e, option) => {
    if (option && option.link) {
      setSelectedManual(option);
      setSelectedTocSection(option);
      setNavAnchor(option.link);
    }
  };

  useEffect(() => {
    if (twManuals && twManuals.length) {
      let manual = twManuals[0];
      let section = twManuals[0].sections[0];
      if (anchor) {
        if (!anchor.includes('--')) {
          setNavAnchor(`${anchor}--${anchor}`);
          return
        }
        section = findTocSection(anchor, twManuals);
      }
      if (section) {
        for (let i = 0; i < twManuals.length; i++) {
          if (twManuals[i].id == section.manual_id) {
            setSelectedTocSection(section);
            setSelectedManual(twManuals[i]);
            return;
          }
        }
      }
      setSelectedManual(manual);
      setSelectedTocSection(twManuals[0].sections[0]);
    }
  }, [anchor, twManuals, setSelectedManual, setSelectedTocSection]);

  return selectedManual && selectedTocSection ? (
    <div style={{ maxWwidth: '700px', width: '80%' }}>
      <Autocomplete
        id="manual-select"
        sx={{ width: '30%', paddingTop: '5px', display: 'inline-block' }}
        options={twManuals}
        autoHighlight
        clearOnEscape
        value={selectedManual}
        getOptionLabel={(option) => option.link.split('--')[0]}
        componentsProps={{ popper: { style: { width: 'fit-content' } } }}
        renderInput={(params) => <TextField {...params} label="Manual" variant="outlined" />}
        renderOption={(props, option) => {
          return (
            <li {...props}>
              <div>
                <span key={option.link}>
                  {option.link.split('--')[0]}: {option.title}
                </span>
              </div>
            </li>
          );
        }}
        isOptionEqualToValue={(option, value) => option.link === value.link}
        onChange={onManualSelectionChange}
      />
      <AutocompleteTocNavigation
        sx={{ width: '60%', paddingTop: '5px', paddingLeft: '5px', display: 'inline-block' }}
        tocSections={twManuals}
        value={selectedTocSection}
        onChange={onTocSectionSelectionChange}
      />
    </div>
  ) : (
    ''
  );
}

TwNavigation.propTypes = {
  twManuals: PropTypes.array,
  anchor: PropTypes.string,
  setNavAnchor: PropTypes.func.isRequired,
};
