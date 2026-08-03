import { createBrowserRouter } from 'react-router-dom'
import App from '../../App'
import { LoginPage } from '../../features/auth/pages/LoginPage'
import { ProfilePage } from '../../features/auth/pages/ProfilePage'
import { RegisterMasterPage } from '../../features/auth/pages/RegisterMasterPage'
import { RegisterPage } from '../../features/auth/pages/RegisterPage'
import { ProtectedRoute } from '../../routing/ProtectedRoute'
import { RoleRoute } from '../../routing/RoleRoute'
import { AdminPage } from '../../views/AdminPage'
import { FavoritesPage } from '../../views/FavoritesPage'
import { HomePage } from '../../views/HomePage'
import { MapPage } from '../../views/MapPage'
import { MasterDetailPage } from '../../views/MasterDetailPage'
import { MastersPage } from '../../views/MastersPage'
import { MasterPanelPage } from '../../views/MasterPanelPage'
import { SalonAdminPanelPage } from '../../views/SalonAdminPanelPage'
import { SalonDetailPage } from '../../views/SalonDetailPage'
import { SalonsPage } from '../../views/SalonsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'salons', element: <SalonsPage /> },
      { path: 'salons/:salonId', element: <SalonDetailPage /> },
      { path: 'masters', element: <MastersPage /> },
      { path: 'masters/:masterId', element: <MasterDetailPage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'register/master', element: <RegisterMasterPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'favorites', element: <FavoritesPage /> },
          {
            element: <RoleRoute allowedRoles={['MASTER']} />,
            children: [{ path: 'master', element: <MasterPanelPage /> }],
          },
          {
            element: <RoleRoute allowedRoles={['SALON_ADMIN']} />,
            children: [{ path: 'salon-admin', element: <SalonAdminPanelPage /> }],
          },
          {
            element: <RoleRoute allowedRoles={['SUPER_ADMIN']} />,
            children: [{ path: 'admin', element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
])
