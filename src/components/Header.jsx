import PropTypes from 'prop-types'
import { Typography } from '@mui/joy'
import { AppBar, Toolbar, Tooltip } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SourceIcon from '@mui/icons-material/Source'

const sx = {
  title: {
    flexGrow: 1,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  infoLine: {
    flexGrow: 1,
    color: '#ffffff',
    ml: 1,
  },
  extendedIcon: {
    marginRight: theme => theme.spacing(1),
  },
}

export default function Header({
  title,
  infoLine,
  dcsRef,
  onOpenClick,
}) {

  const handleViewClick = () => {
    if (dcsRef) window.open(dcsRef, "_blank", "noreferrer")
  }

  return (
    <header>
      <AppBar position='relative'>
        <Toolbar sx={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              overflowX: "scroll",
              button: {
                flex: "none"
              }
        }}>
          <div className='flex flex-1 justify-center items-center'>
            <Typography
              variant='h1'
              sx={sx.title}>
              <a href={"/"} style={{textDecoration:"none", color: "inherit"}}>{title}</a>
            </Typography>
            <Typography
              variant='h3'
              sx={sx.infoLine}>
              {infoLine}
            </Typography>
          </div>
            <Tooltip title="View on DCS" arrow>
              <SourceIcon sx={sx.extendedIcon} onClick={handleViewClick} />
            </Tooltip>
            <Tooltip title="Open another project" arrow>
              <OpenInNewIcon sx={sx.extendedIcon} onClick={onOpenClick} />
            </Tooltip>
        </Toolbar>
      </AppBar>
    </header>
  )
}

Header.propTypes = {
  title: PropTypes.string,
  infoLine: PropTypes.object,
  dcsRef: PropTypes.string,
  ready: PropTypes.bool,
  onPrintClick: PropTypes.func,
  onOpenClick: PropTypes.func,
}
