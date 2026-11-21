import ReactDOM from 'react-dom/client';
import App from './App';
import CustomerApp from './customer/CustomerApp';
import { isDemoMode } from './api/config';
import './styles.css';
import './customer/phase3.css';
import './customer/discover.css';
import './customer/phase4-design.css';

// Routing (no router dependency; refresh-token rotation requires no StrictMode double-mount):
//   demo mode            -> original demo workspace (Admin/Customer preview switch)
//   live mode, /admin/*  -> Super Admin console (existing App)
//   live mode, anything else -> live Customer app (real auth + portal)
const isAdminPath = window.location.pathname.startsWith('/admin');
const Root = !isDemoMode && !isAdminPath ? CustomerApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
