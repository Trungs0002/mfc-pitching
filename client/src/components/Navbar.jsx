import React from 'react';
import { useNavigate } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  return (
    <header className="site-header">
      <nav className="site-nav">
        <div className="nav-brand" onClick={() => navigate('/')}>
          <img src="/logo-mfc.jpeg" alt="MFC logo" />
          <div className="nav-brand-text">
            <strong>MFC & FASHION CLUB</strong>
            <span>FOREIGN TRADE UNIVERSITY</span>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
