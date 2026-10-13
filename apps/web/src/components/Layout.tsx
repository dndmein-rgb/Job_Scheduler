import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${
    isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
  }`;

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-slate-800 bg-slate-900 p-4">
        <div className="mb-6 text-lg font-semibold tracking-tight">
          Job Platform
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/jobs" className={linkClass}>
            Jobs
          </NavLink>
          <NavLink to="/jobs/new" className={linkClass}>
            Create job
          </NavLink>
          <NavLink to="/dead-letter" className={linkClass}>
            Dead letter
          </NavLink>
          <NavLink to="/workers" className={linkClass}>
            Workers
          </NavLink>
          <NavLink to="/queues" className={linkClass}>
            Queues
          </NavLink>
          <NavLink to="/system" className={linkClass}>
            System
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}