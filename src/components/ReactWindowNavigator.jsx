import * as React from 'react'
import PropTypes from 'prop-types'
import { FixedSizeList } from 'react-window'
import { Popper } from '@mui/base/Popper'
import Autocomplete from '@mui/joy/Autocomplete'
import AutocompleteListbox from '@mui/joy/AutocompleteListbox'
import AutocompleteOption from '@mui/joy/AutocompleteOption'
import FormControl from '@mui/joy/FormControl'
import ListSubheader from '@mui/joy/ListSubheader'
import MenuBook from '@mui/icons-material/MenuBook'

const LISTBOX_PADDING = 6 // px

function renderRow(props) {
  const { data, index, style } = props
  const dataSet = data[index]
  const inlineStyle = {
    ...style,
    top: style.top + LISTBOX_PADDING,
  }

  // eslint-disable-next-line no-prototype-builtins
  if (dataSet.hasOwnProperty('group')) {
    return (
      <ListSubheader key={dataSet.key} component="li" style={inlineStyle}>
        {dataSet.group}
      </ListSubheader>
    )
  }

  return (
    <AutocompleteOption {...dataSet[0]} style={inlineStyle}>
      {dataSet[1]}
    </AutocompleteOption>
  )
}

const OuterElementContext = React.createContext({})

// eslint-disable-next-line react/display-name
const OuterElementType = React.forwardRef((props, ref) => {
  const outerProps = React.useContext(OuterElementContext)
  return (
    <AutocompleteListbox
      {...props}
      {...outerProps}
      component="div"
      ref={ref}
      sx={{
        '& ul': {
          padding: 0,
          margin: 0,
          flexShrink: 0,
        },
      }}
    />
  )
})

// Adapter for react-window

const ListboxComponent = React.forwardRef(function ListboxComponent(props, ref) {
  const { children, anchorEl, open, modifiers, ...other } = props
  const itemData = []

  children[0].forEach((item) => {
    if (item) {
      itemData.push(item)
      itemData.push(...(item.children || []))
    }
  })

  const itemCount = itemData.length
  const itemSize = 40

  return (
    <Popper ref={ref} anchorEl={anchorEl} open={open} modifiers={modifiers}>
      <OuterElementContext.Provider value={other}>
        <FixedSizeList
          itemData={itemData}
          height={itemSize * 8}
          width="100%"
          outerElementType={OuterElementType}
          innerElementType="ul"
          itemSize={itemSize}
          overscanCount={5}
          itemCount={itemCount}
        >
          {renderRow}
        </FixedSizeList>
      </OuterElementContext.Provider>
    </Popper>
  )
})

ListboxComponent.propTypes = {
  anchorEl: PropTypes.any.isRequired,
  children: PropTypes.any,
  modifiers: PropTypes.array.isRequired,
  open: PropTypes.bool.isRequired,
}


export default function ReactWindowNavigator({options: curOptions,defaultValue,onInputChange}) {

  // eslint-disable-next-line no-unused-vars
  const [value, setValue] = React.useState(defaultValue||"")
  const [inputValue, setInputValue] = React.useState("")
  
  const isEquualOption = (option, value) => (option.value === value.value)
  
  const onSelectBookClick = () => console.log("onSelectBookClick")

  return (
    <FormControl id="virtualize-demo">
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
        sx={{ width: 300 }}
        disableListWrap
        slots={{
          listbox: ListboxComponent,
        }}
        options={curOptions}
        groupBy={(option) => option.chapter}
        getOptionLabel={(option)=>option.label}
        renderOption={(props, option) => [props, option.label]}
        // TODO: Post React 18 update - validate this conversion, look like a hidden bug
        renderGroup={(params) => params}
      />
    </FormControl>
  )
}

ReactWindowNavigator.propTypes = {
  options: PropTypes.array.isRequired,
  defaultValue: PropTypes.any,
  onInputChange: PropTypes.func,
}
