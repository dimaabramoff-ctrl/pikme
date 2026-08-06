import { createBrowserRouter } from 'react-router-dom'
import App from '../../App'
import { LoginPage } from '../../features/auth/pages/LoginPage'
import { PartnerLoginPage } from '../../features/auth/pages/PartnerLoginPage'
import { PartnerRegisterPage } from '../../features/auth/pages/PartnerRegisterPage'
import { ProfilePage } from '../../features/auth/pages/ProfilePage'
import { RegisterMasterPage } from '../../features/auth/pages/RegisterMasterPage'
import { RegisterPage } from '../../features/auth/pages/RegisterPage'
import { ProtectedRoute } from '../../routing/ProtectedRoute'
import { RoleRoute } from '../../routing/RoleRoute'
import { AdminPage } from '../../views/AdminPage'
import { ExternalSalonDetailPage } from '../../views/ExternalSalonDetailPage'
import { FavoritesPage } from '../../views/FavoritesPage'
import { HomePage } from '../../views/HomePage'
import { MapPage } from '../../views/MapPage'
import { MasterAdminPage } from '../../views/MasterAdminPage'
import { MasterDetailPage } from '../../views/MasterDetailPage'
import { MastersPage } from '../../views/MastersPage'
import { MasterPanelPage } from '../../views/MasterPanelPage'
import { RedeemPage } from '../../views/RedeemPage'
import { SalonAdminPanelPage } from '../../views/SalonAdminPanelPage'
import { SalonDetailPage } from '../../views/SalonDetailPage'
import { SalonsPage } from '../../views/SalonsPage'
import { PartnerOnboardingGuard } from '../../features/business-claims/PartnerOnboardingGuard'
import { BusinessAccessCodesAdminGuard } from '../../views/BusinessAccessCodesAdminGuard'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'salons', element: <SalonsPage /> },
      { path: 'salons/external/:externalId', element: <ExternalSalonDetailPage /> },
      { path: 'salons/:salonId', element: <SalonDetailPage /> },
      { path: 'masters', element: <MastersPage /> },
      { path: 'masters/:masterId', element: <MasterDetailPage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'login/partner', element: <PartnerLoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'register/master', element: <RegisterMasterPage /> },
      { path: 'partner/register', element: <PartnerRegisterPage /> },
      { path: 'redeem', element: <RedeemPage /> },
      { path: 'master-admin', element: <MasterAdminPage /> },
      { path: 'master-admin/business-access-codes', element: <BusinessAccessCodesAdminGuard /> },
      { path: 'partner/onboarding', element: <PartnerOnboardingGuard /> },
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
            element: <RoleRoute allowedRoles={['SALON_OWNER', 'SALON_ADMIN']} />,
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
