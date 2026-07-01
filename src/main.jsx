import ReactDOM from 'react-dom/client'
import PreviewApp from './rebuild/PreviewApp'
import './index.css'

// Rebuild entry: the thin, server-rendered client. The legacy App/AppWorkspace
// tree remains in the repo for salvage but is no longer mounted.
ReactDOM.createRoot(document.getElementById('root')).render(
  <PreviewApp />
)
