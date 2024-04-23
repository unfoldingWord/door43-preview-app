// Importing prop-types for type checking
import PropTypes from 'prop-types';

// Importing components from Material UI Joy
import { FormControl, FormLabel, Radio, RadioGroup } from '@mui/joy';

export default function PageOrientationSelector({ formLabelTitle, setPageOrientation }) {
  return (
    <>
      <form style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
        <FormControl>
          <FormLabel>{formLabelTitle}</FormLabel>
          <RadioGroup defaultValue="P" variant="oulined" name="radio-buttons-group-focus" onChange={(e) => setPageOrientation(e?.target?.value)}>
            <Radio value="P" label="Portrait" />
            <Radio value="L" label="Landscape" />
          </RadioGroup>
        </FormControl>
      </form>
    </>
  );
}

PageOrientationSelector.propTypes = {
  formLabelTitle: PropTypes.string,
  setPageOrientation: PropTypes.func,
};
