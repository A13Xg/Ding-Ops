import { createRoot } from 'react-dom/client';
import 'material-symbols/outlined.css';
import './styles.css';
import './mobileFeedback.css';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { DingApp } from './DingApp.jsx';

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <DingApp />
  </ErrorBoundary>
);
