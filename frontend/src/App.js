import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import Navbar from "./components/Navbar";
import ThreeLogoBackground from "./components/ThreeLogoBackground";
import HomePage from "./pages/HomePage";
import RecruitmentDetailPage from "./pages/RecruitmentDetailPage";
import MyApplicationsPage from "./pages/MyApplicationsPage";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import StaffDashboard from "./pages/StaffDashboard";
import StaffRecruitmentForm from "./pages/StaffRecruitmentForm";
import StaffApplicationsPage from "./pages/StaffApplicationsPage";
import StaffApplicationDetailPage from "./pages/StaffApplicationDetailPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="App min-h-screen" style={{ background: "#050505" }}>
          <ThreeLogoBackground />
          <div className="relative z-10 min-h-screen">
            <Navbar />
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
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
