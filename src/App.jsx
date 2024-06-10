import AppWorkspace from './components/AppWorkspace'
import { AppContextProvider } from '@contexts/App.context'
import './App.css'

function App() {
  return (
    <AppContextProvider >
      <AppWorkspace />
    </AppContextProvider >
  );
}

export default App
