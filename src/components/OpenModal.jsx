import { useEffect, useState, useContext, useRef, Fragment } from "react"
import { Button, Modal, ModalDialog, Typography } from "@mui/joy"
import { Transition } from "react-transition-group"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import CloseIcon from "@mui/icons-material/Close"
import PropTypes from "prop-types"
import { AppContext } from "./App.context"
import Navigator from "./Navigator"

export default function OpenModal({ isOpenModal, onCloseModal }) {
  const {
    state: {
      branches,
      languages,
      organizations,
      repos,
      tags,
      repo,
      catalogEntry,
    },
  } = useContext(AppContext)

  const [langOptions, setLangOptions] = useState()
  const [organiOptions, setOrganiOptions] = useState()
  const [tagsBranchesOptions, setTagsBranchesOptions] = useState()
  const [repoOptions, setRepoOptions] = useState()
  const [langValue, setLangValue] = useState()
  const [organiValue, setOrganiValue] = useState()
  const [tagsBranchesValue, setTagsBranchesValue] = useState()
  const [repoValue, setRepoValue] = useState()

  useEffect(() => {
    if (repo?.language && repo?.language_title) 
      setLangValue({
        label: repo?.language_title,
        value: repo?.language,
      })
  },[repo, repo?.language, repo?.language_title])

  useEffect(() => {
    if (repo?.owner) {
      setOrganiValue({
        label: repo?.owner.username,
        value: repo?.owner.username,
      })
    }
  },[repo?.owner])

  useEffect(() => {
    if (catalogEntry?.branch_or_tag_name) 
      setTagsBranchesValue({
        label: catalogEntry?.branch_or_tag_name,
        value: catalogEntry?.branch_or_tag_name,
        })
  },[catalogEntry?.branch_or_tag_name])

  useEffect(() => {
    if (repo?.name) 
      setRepoValue({
        label: repo?.name,
        value: repo?.name,
        })
  },[repo?.name])

  useEffect(() => {
    const _langOptions =
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
    setLangOptions([..._langOptions, { label: "", value: "" }])
  },[languages])

  useEffect(() => {
    if (organizations) {
      const _organiOptions = organizations?.map((x) => ({ label: x, value: x }))
      setOrganiOptions([..._organiOptions, { label: "", value: "" }])
    }
  },[organizations])

  useEffect(() => {
    if (branches && tags) {
      const _tagsOptions = tags.map((x) => ({ label: x.label, value: x.label })) 
      const _branchesOptions = branches.map((x) => ({ label: x.label, value: x.label })) 
      setTagsBranchesOptions([..._tagsOptions, ..._branchesOptions, { label: "", value: "" }])
    }
  },[branches, tags])

  useEffect(() => {
    if (repos) {
      const _repoOptions = repos.map((x) => ({ label: x.name, value: x.name }))  
      setRepoOptions([..._repoOptions, { label: "", value: "" }])
    }
  },[repos])

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
                <Navigator
                  onChange={(_, newValue) => {
                    setLangValue(prev => {
                      if (prev!==newValue) {
                        setOrganiValue({ label: "", value: "" })
                        setRepoValue({ label: "", value: "" })
                        setTagsBranchesValue({ label: "", value: "" })
                      }
                      return newValue
                    })
                  }}
                  value={langValue}
                  options={langOptions}
                />
              )}
              {organiOptions && catalogEntry?.owner && (
                <Navigator
                  onChange={(_, newValue) => {
                    setOrganiValue(prev => {
                      if (prev!==newValue) {
                        setRepoValue({ label: "", value: "" })
                        setTagsBranchesValue({ label: "", value: "" })
                      }
                      return newValue
                    })
                  }}
                  value={organiValue}
                  options={organiOptions}
                />
              )}              
              {repoOptions && catalogEntry?.name && (
                <Navigator
                  onChange={(_, newValue) => {
                    setRepoValue(prev => {
                      if (prev!==newValue) {
                        setTagsBranchesValue({ label: "", value: "" })
                      }
                      return newValue
                    })
                  }}
                  value={repoValue}
                  options={repoOptions}
                />
              )}
              {tagsBranchesOptions && catalogEntry?.branch_or_tag_name && (
                <Navigator
                  onChange={(_, newValue) => {
                    setTagsBranchesValue(newValue)
                  }}
                  value={tagsBranchesValue}
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
