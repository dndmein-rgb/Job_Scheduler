const links = [
  { name: "Kafka UI", href: "http://localhost:8084" },
  { name: "Redis Insight", href: "http://localhost:8002" },
  { name: "pgAdmin", href: "http://localhost:8085" },
  { name: "Prometheus metrics", href: "http://localhost:3010/metrics" },
];

export function System() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">System</h1>
      <p className="text-sm text-slate-400">
        Deep links to infra UIs (already running via Docker Compose)
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline"
            >
              {l.name} →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}