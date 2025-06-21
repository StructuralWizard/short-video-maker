import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VideoList from './pages/VideoList';
import VideoCreator from './pages/VideoCreator';
import VideoDetails from './pages/VideoDetails';
import VideoEditor from './pages/VideoEditor';
import Layout from './components/Layout';
import TTSGenerator from './TTSGenerator';

const App: React.FC = () => {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Layout>
        <Routes>
          <Route path="/" element={<VideoList />} />
          <Route path="/create" element={<VideoCreator />} />
          <Route path="/video/:id" element={<VideoDetails />} />
          <Route path="/edit/:id" element={<VideoEditor />} />
          <Route path="/video/:id/edit" element={<VideoEditor />} />
          <Route path="/tts" element={<TTSGenerator />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App; 