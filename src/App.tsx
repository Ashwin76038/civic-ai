import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import 'leaflet/dist/leaflet.css'; // Import Leaflet CSS for map styling
import Home from './components/Home';
import SignUp from './components/SignUp';
import Login from './components/Login';
import AdminLogin from './components/AdminLogin';
import Dashboard from './components/Dashboard';
import ReportIssue from './components/ReportIssue';
import TrackComplaints from './components/TrackComplaints';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<ReportIssue />} />
          <Route path="/track" element={<TrackComplaints />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;