import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Jobs } from "./pages/Jobs";
import { CreateJob } from "./pages/CreateJob";
import { JobDetail } from "./pages/JobDetail";
import { DeadLetter } from "./pages/DeadLetter";
import { Workers } from "./pages/Workers";
import { Queues } from "./pages/Queues";
import { System } from "./pages/System";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/new" element={<CreateJob />} />
          <Route path="jobs/:id" element={<JobDetail />} />
          <Route path="dead-letter" element={<DeadLetter />} />
          <Route path="workers" element={<Workers />} />
          <Route path="queues" element={<Queues />} />
          <Route path="system" element={<System />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}