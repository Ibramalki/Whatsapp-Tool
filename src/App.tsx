import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import {
  Users,
  Megaphone,
  FileText,
  MessageSquare,
  LayoutDashboard,
  CalendarClock,
  Wifi,
} from 'lucide-react'
import { cn } from './lib/utils'
import Dashboard from './pages/Dashboard'
import LeadsPage from './pages/LeadsPage'
import TemplatesPage from './pages/TemplatesPage'
import CampaignsPage from './pages/CampaignsPage'
import LogsPage from './pages/LogsPage'
import SchedulePage from './pages/SchedulePage'
import GroupsPage from './pages/GroupsPage'

const navItems = [
  { to: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/leads', label: 'العملاء', icon: Users },
  { to: '/templates', label: 'القوالب', icon: FileText },
  { to: '/campaigns', label: 'الحملات', icon: Megaphone },
  { to: '/schedule', label: 'الجدولة', icon: CalendarClock },
  { to: '/groups', label: 'المجموعات', icon: Wifi },
  { to: '/logs', label: 'سجل الرسائل', icon: MessageSquare },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 bg-white border-l border-gray-200 flex flex-col shadow-sm">
          {/* Logo */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-500 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">WhatsApp CRM</p>
                <p className="text-xs text-gray-400">أداة التسويق</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">v0.1.0</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/logs" element={<LogsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
