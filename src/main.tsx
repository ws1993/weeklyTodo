import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components/app-shell.css';
import './styles/components/topbar.css';
import './styles/components/buttons.css';
import './styles/components/week-rail.css';
import './styles/components/main-area.css';
import './styles/components/task-tree.css';
import './styles/components/empty-state.css';
import './styles/components/tree-groups-leaf.css';
import './styles/components/actions-pane.css';
import './styles/components/modals.css';
import './styles/components/settings.css';
import './styles/components/about.css';
import './styles/components/proxy-settings.css';
import './styles/components/webdav-sync.css';
import './styles/components/management.css';
import './styles/components/query-view.css';
import './styles/components/statistics.css';
import './styles/components/share-card.css';
import './styles/components/states.css';
import './styles/components/kanban-view.css';
import './styles/components/focus-banner.css';
import './styles/components/command-palette.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
