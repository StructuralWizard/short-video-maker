import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VideoList from './pages/VideoList';
import VideoCreator from './pages/VideoCreator';
import VideoDetails from './pages/VideoDetails';
import VideoEditor from './pages/VideoEditor';
import TTSGenerator from './pages/TTSGenerator';
import Layout from './components/Layout';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<VideoList />} />
          <Route path="/video/:id" element={<VideoDetails />} />
          <Route path="/create" element={<VideoCreator />} />
          <Route path="/edit/:id" element={<VideoEditor />} />
          <Route path="/tts" element={<TTSGenerator />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App; 