import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { FullPageLoader } from '@/components/feedback/FullPageLoader';
import { RequireAuth, PublicOnly } from '@/features/auth/RequireAuth';
import { RouteErrorPage, NotFoundPage } from '@/routes/ErrorPages';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/PasswordResetPages').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/PasswordResetPages').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage'));
const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const PrivacyPage = lazy(() => import('@/features/landing/LegalPages').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('@/features/landing/LegalPages').then((m) => ({ default: m.TermsPage })));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const SearchPage = lazy(() => import('@/features/food-search/SearchPage'));
const DiaryPage = lazy(() => import('@/features/food-log/DiaryPage'));
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage'));
const RecipesPage = lazy(() => import('@/features/recipes/RecipesPage'));
const RecipeBuilderPage = lazy(() => import('@/features/recipes/RecipeBuilderPage'));
const FoodsPage = lazy(() => import('@/features/favorites/FoodsPage'));
const TrackingPage = lazy(() => import('@/features/tracking/TrackingPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));

const page = (node: ReactNode) => <Suspense fallback={<FullPageLoader />}>{node}</Suspense>;

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: page(<PublicOnly><LandingPage /></PublicOnly>) },
      { path: '/login', element: page(<PublicOnly><LoginPage /></PublicOnly>) },
      { path: '/register', element: page(<PublicOnly><RegisterPage /></PublicOnly>) },
      { path: '/forgot-password', element: page(<ForgotPasswordPage />) },
      { path: '/reset-password', element: page(<ResetPasswordPage />) },
      { path: '/verify-email', element: page(<VerifyEmailPage />) },
      { path: '/privacy', element: page(<PrivacyPage />) },
      { path: '/terms', element: page(<TermsPage />) },
      { path: '/onboarding', element: page(<RequireAuth onboarding="skip"><OnboardingPage /></RequireAuth>) },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/diary', element: <DiaryPage /> },
          { path: '/calendar', element: <CalendarPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/goals', element: <GoalsPage /> },
          { path: '/recipes', element: <RecipesPage /> },
          { path: '/recipes/new', element: <RecipeBuilderPage /> },
          { path: '/recipes/:recipeId', element: <RecipeBuilderPage /> },
          { path: '/foods', element: <FoodsPage /> },
          { path: '/tracking', element: <TrackingPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/home', element: <Navigate to="/dashboard" replace /> },
          { path: '*', element: <NotFoundPage inShell /> },
        ],
      },
    ],
  },
]);
