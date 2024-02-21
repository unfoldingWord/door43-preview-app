import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Autocomplete, TextField } from '@mui/material'
import AutocompleteTocNavigation from "../../core/components/AutocompleteTocNavigation"

export default function TaNavigation({
  taManuals,
  anchor,
  setDocumentAnchor,
}) {
  const [selectedManual, setSelectedManual] = useState()
  const [selectedTocSection, setSelectedTocSection] = useState()

    // const scrollToElement = (elementId) => {
    //   const element = document.getElementById(elementId);
    //   if (element) {
    //     window.scrollTo({
    //       top: element.getBoundingClientRect().top + window.scrollY,
    //       behavior: "smooth",
    //     });
    //   }
    //   window.history.replaceState({ id: "100" }, "", `${window.location.href.split("#")[0]}#${elementId}`);
    // }

    const onTocSectionSelectionChange = (e, option) => {
      if(option && option.link) {
        const manualId = option.link.split('--')[0]
        if (!selectedManual || selectedManual.link != `${manualId}--${manualId}`) {
          for(let i = 0; i < taManuals.length; i++) {
            if (taManuals[i].link == `${manualId}--${manualId}`) {
              setSelectedManual(taManuals[i])
              break
            }
          }
        }
        setSelectedTocSection(option)
        setDocumentAnchor(option.link)
      }
    }      

    const onManualSelectionChange = (e, option) => {
      if (option && option.link) {
        setSelectedManual(option)
        setSelectedTocSection(option)
        setDocumentAnchor(option.link)
      }
    }

    const findTocSection = (link, sections) => {
      if (! sections || !sections.length) {
        return null
      }
      for(let i = 0; i < sections.length; i++) {
        if (sections[i].link == link) {
          return sections[i]
        }
        const section = findTocSection(link, sections[i].sections)
        if (section) {
          return section
        }
      }
    }

    useEffect(() => {
      if (taManuals && taManuals.length) {
        let manual = taManuals[0]
        let section = taManuals[0]
        if (anchor) {
          section = findTocSection(anchor, taManuals)
        }
        if (section) {
          for(let i = 0; i < taManuals.length; i++) {
            if (taManuals[i].id == section.manual_id) {
              setSelectedTocSection(section)
              setSelectedManual(taManuals[i])
              return
            }
          }
        }
        setSelectedManual(taManuals[0])
        setSelectedTocSection(taManuals[0].sections[0])
      }
    }, [taManuals])

    return (
          selectedManual && selectedTocSection ? 
          <div style={{maxWwidth: "700px", width: "80%"}}>
            <Autocomplete
              id="manual-select"
              sx={{ width: "30%", paddingTop: "5px", display: "inline-block" }}
              options={taManuals}
              autoHighlight
              clearOnEscape
              value={selectedManual}
              getOptionLabel={option => option.link.split("--")[0]}
              componentsProps={{ popper: { style: { width: 'fit-content' } } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Manual"
                  variant="outlined"
                />
              )}
              renderOption={(props, option) => {
                return (
                  <li {...props}>
                    <div>
                      <span
                        key={option.link}
                      >
                        {option.link.split('--')[0]}: {option.title}
                      </span>
                    </div>
                  </li>
                )
              }}        
              isOptionEqualToValue={(option, value) => option.link === value.link}
              onChange={onManualSelectionChange}
            />
            <AutocompleteTocNavigation
                sx={{ width: "60%", paddingTop: "5px", paddingLeft: "5px", display: "inline-block" }}
                tocSections={taManuals}
                value={selectedTocSection}
                onChange={onTocSectionSelectionChange}
            />
          </div> : "")
}
