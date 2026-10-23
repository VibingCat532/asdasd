import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./hooks/useAuth";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import RecruitmentDetailPage from "./pages/RecruitmentDetailPage";
import MyApplicationsPage from "./pages/MyApplicationsPage";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import StaffDashboard from "./pages/StaffDashboard";
import StaffRecruitmentForm from "./pages/StaffRecruitmentForm";
import StaffApplicationsPage from "./pages/StaffApplicationsPage";
import StaffApplicationDetailPage from "./pages/StaffApplicationDetailPage";
import StaffApplicationHistoryPage from "./pages/StaffApplicationHistoryPage";

import StaffStatisticsPage from "./pages/StaffStatisticsPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="App flex min-h-screen flex-col bg-hs-ground">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/recruitment/:id" element={<RecruitmentDetailPage />} />
              <Route path="/my-applications" element={<MyApplicationsPage />} />
              <Route path="/my-applications/:id" element={<ApplicationDetailPage />} />
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/staff/recruitments/new" element={<StaffRecruitmentForm />} />
              <Route path="/staff/recruitments/:id/edit" element={<StaffRecruitmentForm />} />
              <Route path="/staff/recruitments/:id/applications" element={<StaffApplicationsPage />} />
              <Route path="/staff/recruitments/:recId/applications/:appId" element={<StaffApplicationDetailPage />} />
              <Route path="/staff/recruitments/:id/statistics" element={<StaffStatisticsPage />} />
              <Route path="/staff/history" element={<StaffApplicationHistoryPage />} />
            </Routes>
          </main>
          <Footer />
          <Analytics />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
