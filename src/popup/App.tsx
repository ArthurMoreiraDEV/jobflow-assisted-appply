import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { ProfileScreen } from './screens/ProfileScreen';
import { SearchScreen } from './screens/SearchScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { QueueScreen } from './screens/QueueScreen';
import { HistoryScreen } from './screens/HistoryScreen';

const tabs = [
  { to: '/perfil', label: 'Perfil' },
  { to: '/busca', label: 'Busca' },
  { to: '/resultados', label: 'Resultados' },
  { to: '/fila', label: 'Fila' },
  { to: '/historico', label: 'Histórico' },
];

export function App() {
  return (
    <>
      <nav className="tabs" aria-label="Navegação principal">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/perfil" replace />} />
        <Route path="/perfil" element={<ProfileScreen />} />
        <Route path="/busca" element={<SearchScreen />} />
        <Route path="/resultados" element={<ResultsScreen />} />
        <Route path="/fila" element={<QueueScreen />} />
        <Route path="/historico" element={<HistoryScreen />} />
      </Routes>
    </>
  );
}
