import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HostView from './views/HostView';
import ControllerView from './views/ControllerView';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HostView />} />
        <Route path="/join" element={<ControllerView />} />
      </Routes>
    </Router>
  );
}

export default App;
