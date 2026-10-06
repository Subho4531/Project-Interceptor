import ReactDOM from 'react-dom/client';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import Routes from './ui/Routes';
import { SessionProvider } from './session/SessionContext';
import './ui/styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<SessionProvider><Routes /></SessionProvider>);
