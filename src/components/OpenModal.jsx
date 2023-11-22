import { useContext, useRef, Fragment } from "react"
import { Button, Modal, ModalDialog, Typography } from "@mui/joy"
import { Transition } from "react-transition-group"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import CloseIcon from "@mui/icons-material/Close"
import PropTypes from "prop-types"
import { AppContext } from "./App.context"
import ReactWindowNavigator from "./ReactWindowNavigator"
import Navigator from "./Navigator"

export default function OpenModal({ isOpenModal, onCloseModal }) {
  const {
    state: { languages, organizations, catalogEntry, tags, branches },
  } = useContext(AppContext)

  const langOptions =
    languages?.map((x) => {
      const ln = x?.ln
      const ang = x?.ang
      const doUseAng = x?.ang && ln !== ang
      const label = doUseAng ? `${x?.ln} (${x.ang})` : x?.ln
      return {
        label,
        value: x?.lc,
      }
    }) || []

  const orgOptions = organizations?.map((x) => ({ label: x, value: x }))
  const tagsBranchesOptions = (branches && tags) ? [...branches, ...tags] : undefined

  const nodeRef = useRef(null)

  return (
    <Fragment>
      <Transition in={isOpenModal} timeout={400} nodeRef={nodeRef}>
        {(state) => (
          <Modal
            open={!["exited", "exiting"].includes(state)}
            onClose={onCloseModal}
            slotProps={{
              backdrop: {
                sx: {
                  opacity: 0,
                  backdropFilter: "none",
                  transition: `opacity 400ms, backdrop-filter 400ms`,
                  ...{
                    entering: { opacity: 1, backdropFilter: "blur(8px)" },
                    entered: { opacity: 1, backdropFilter: "blur(8px)" },
                  }[state],
                },
              },
            }}
            sx={{
              visibility: state === "exited" ? "hidden" : "visible",
            }}
          >
            <ModalDialog
              ref={nodeRef}
              sx={{
                opacity: 0,
                transition: `opacity 300ms`,
                ...{
                  entering: { opacity: 1 },
                  entered: { opacity: 1 },
                }[state],
              }}
            >
              <Typography variant="h2" sx={{ textAlign: "center" }}>
                Open new preview
              </Typography>
              {langOptions && catalogEntry?.language_title && (
                <ReactWindowNavigator
                  options={langOptions}
                  defaultValue={{
                    label: catalogEntry?.language_title,
                    value: "en",
                  }}
                  onInputChange={(event, newInputValue) =>
                    console.log(event, newInputValue)
                  }
                />
              )}
              {orgOptions && catalogEntry?.owner && (
                <Navigator
                  onInputChange={(event, newInputValue) => {
                    console.log(event, newInputValue)
                  }}
                  defaultValue={{
                    label: catalogEntry?.owner,
                    value: catalogEntry?.owner,
                  }}
                  options={orgOptions}
                />
              )}
              {tagsBranchesOptions && catalogEntry.branch_or_tag_name && (
                <Navigator
                  onInputChange={(event, newInputValue) => {
                    console.log(event, newInputValue)
                  }}
                  defaultValue={{
                    label: catalogEntry.branch_or_tag_name,
                    value: tagsBranchesOptions[0].value
                  }}
                  options={tagsBranchesOptions}
                />
              )}

              <Button
                sx={{ margin: "4%" }}
                // onClick={onPrintClick}
              >
                <OpenInNewIcon color="primary" />
                Open
              </Button>
              <Button sx={{ margin: "4%" }} onClick={onCloseModal}>
                <CloseIcon color="primary" />
                Cancel
              </Button>
            </ModalDialog>
          </Modal>
        )}
      </Transition>
    </Fragment>
  )
}

OpenModal.propTypes = {
  /** OpenModal is open when this is set true */
  isOpenModal: PropTypes.bool,
  /** handle the needed actions, when modal is closed */
  onCloseModal: PropTypes.func,
}

OpenModal.defaultProps = {
  canChangeAtts: false,
  canChangeColumns: false,
}
