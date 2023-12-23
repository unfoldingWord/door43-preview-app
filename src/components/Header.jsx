import PropTypes from 'prop-types'
import { Typography } from '@mui/joy'
import { AppBar, Toolbar, Fab, Hidden } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PrintIcon from '@mui/icons-material/Print'
import SourceIcon from '@mui/icons-material/Source'
import { DISABLE_NAVIGATION_BUTTON } from '../common/constants'

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
  ready,
  onPrintClick,
  onOpenClick,
}) {

  const handleViewClick = () => {
    if (dcsRef) window.open(dcsRef, "_blank", "noreferrer")
  }

  return (
    <header>
      <AppBar position='relative'>
        <Toolbar sx={{ justifyContent: "space-between" }}>
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
            <Fab
              color='primary'
              aria-label='open'
              variant='extended'
              disabled={!ready}
              onClick={onPrintClick}>
              <PrintIcon sx={sx.extendedIcon} />
              <Hidden xsDown>Print</Hidden>
            </Fab>
            <Fab
              color='primary'
              aria-label='view'
              variant='extended'
              disabled={true}
              onClick={handleViewClick}>
              <SourceIcon sx={sx.extendedIcon} />
              <Hidden xsDown>View on DCS</Hidden>
            </Fab>
            <Fab
              color='primary'
              aria-label='print'
              variant='extended'
              disabled={true}
              onClick={onOpenClick}>
              <OpenInNewIcon sx={sx.extendedIcon} />
              <Hidden xsDown>Open</Hidden>
            </Fab>
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
