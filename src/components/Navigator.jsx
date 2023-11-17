import * as React from 'react'
import PropTypes from 'prop-types'
import Autocomplete from '@mui/joy/Autocomplete'
import MenuBook from '@mui/icons-material/MenuBook'

export default function Navigator({options: curOptions,defaultValue,onInputChange}) {

  // eslint-disable-next-line no-unused-vars
  const [value, setValue] = React.useState(defaultValue)
  const [inputValue, setInputValue] = React.useState("")
  
  const isEquualOption = (option, value) => (option.value === value.value)
  
  const onSelectBookClick = () => console.log("onSelectBookClick")

  return (
    <Autocomplete
      startDecorator={<MenuBook
        onClick={onSelectBookClick}
      />}
      value={value}
      onChange={(event, newValue) => {
        console.log(newValue)
        setValue(newValue);
      }}
      inputValue={inputValue}
      isOptionEqualToValue={isEquualOption}
      onInputChange={(event, newInputValue) => {
        onInputChange(event,newInputValue)
        setInputValue(newInputValue);
      }}
      options={curOptions}
      sx={{ width: 300 }}
      getOptionLabel={(option)=>option.label||""}
      // TODO: Post React 18 update - validate this conversion, look like a hidden bug
      renderGroup={(params) => params}
    />
  )
}

Navigator.propTypes = {
  options: PropTypes.array.isRequired,
  defaultValue: PropTypes.any,
  onInputChange: PropTypes.func,
}
