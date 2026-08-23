import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import MobileNav from './components/MobileNav'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import About from './pages/About'
import Analyze from './pages/Analyze'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Reports from './pages/Reports'
import Result from './pages/Result'

export default function App() {
  const [image, setImage] = useState(null)
  const [latestResult, setLatestResult] = useState(null)

  return (
    <>
      <Sidebar />
      <Navbar />
      <main className="mx-auto min-h-[calc(100vh-64px)] max-w-7xl px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:ml-64 lg:px-8 lg:pb-12 animate-fade-in">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/analyze"
            element={
              <Analyze
                image={image}
                setImage={setImage}
                setLatestResult={setLatestResult}
              />
            }
          />
          <Route path="/result" element={<Result latestResult={latestResult} />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports latestResult={latestResult} />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
      <MobileNav />
    </>
  )
}
