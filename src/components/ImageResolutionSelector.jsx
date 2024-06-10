import PropTypes from 'prop-types';
import { Typography, Option, Select } from '@mui/joy';

export default function ImageResolutionSelector({ formLabelTitle, value, setImageResolution }) {
  return (
    <>
      <form>
        <Typography id="page-size-group-label" sx={{ marginRight: '5%', marginTop: '1%' }}>
          {formLabelTitle}
        </Typography>
        <Select
          aria-labelledby="page-size-group-label"
          name="page-size-buttons-group"
          value={value}
          style={{ width: '100px' }}
          color="primary"
          onChange={(e, value) => setImageResolution(value)}
        >
          <Option key="0" value="none">Hide Images</Option>
          <Option key="1" value="360px">640x360px</Option>
          <Option key="2" value="2160px">3840x2160px</Option>
        </Select>
      </form>
    </>
  );
}

ImageResolutionSelector.propTypes = {
  formLabelTitle: PropTypes.string,
  imageResolution: PropTypes.string,
  setImageResolution: PropTypes.func,
};
