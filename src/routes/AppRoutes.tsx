import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { ProtectedRoute } from './ProtectedRoute';

import { Login } from '../pages/Login/Login';
import { Register } from '../pages/Register/Register';
import { Dashboard } from '../pages/Dashboard/Dashboard';
import { Players } from '../pages/Players/Players';
import { PlayerDetail } from '../pages/PlayerDetail/PlayerDetail';
import { Callups } from '../pages/Callups/Callups';
import { MatchMap } from '../pages/Map/Map';
import { Training } from '../pages/Training/Training';
import { Reports } from '../pages/Reports/Reports';
import { AdminScraping } from '../pages/Admin/AdminScraping';
import { AdminUsers } from '../pages/Admin/AdminUsers';
import { AdminSettings } from '../pages/Admin/AdminSettings';
import { AdminLogs } from '../pages/Admin/AdminLogs';
import { Teams } from '../pages/Teams/Teams';
import { CalendarView } from '../pages/Calendar/CalendarView';
import { SelectedPlayers } from '../pages/SelectedPlayers/SelectedPlayers';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />

      {/* Rutas Autenticadas Protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jugadores" element={<Players />} />
          <Route path="/jugadores/:id" element={<PlayerDetail />} />
          <Route path="/seleccionados" element={<SelectedPlayers />} />
          <Route path="/convocatorias" element={<Callups />} />
          <Route path="/entrenamientos" element={<Training />} />
          <Route path="/informes" element={<Reports />} />
          <Route path="/calendario" element={<CalendarView />} />
          <Route path="/mapa" element={<MatchMap />} />
          <Route path="/equipos" element={<Teams />} />

          {/* Rutas exclusivas para Administrador */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/administracion/usuarios" element={<AdminUsers />} />
            <Route path="/administracion/ajustes" element={<AdminSettings />} />
            <Route path="/administracion/scraping" element={<AdminScraping />} />
            <Route path="/administracion/logs" element={<AdminLogs />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback 404 Redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
