import PropTypes from 'prop-types';
import Autocomplete from '@mui/joy/Autocomplete';

export default function Navigator(props) {
  const {
    // eslint-disable-next-line no-unused-vars
    isOptionEqualToValue: orgIsOptionEqualToValue,
    // eslint-disable-next-line no-unused-vars
    getOptionLabel: orgGetOptionLabel,
    ...rest
  } = props;

  const isEquualOption = (option, value) => option?.value === value?.value;

  return <Autocomplete isOptionEqualToValue={isEquualOption} getOptionLabel={(option) => option?.label || ''} {...rest} />;
}

Navigator.propTypes = {
  options: PropTypes.array.isRequired,
  defaultValue: PropTypes.any,
  onInputChange: PropTypes.func,
  isOptionEqualToValue: PropTypes.any,
  getOptionLabel: PropTypes.any,
  renderGroup: PropTypes.any,
};
