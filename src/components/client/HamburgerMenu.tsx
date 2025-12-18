import { useState, ReactNode } from 'react';

interface HamburgerMenuProps {
  children: ReactNode;
}

function HamburgerMenu({ children }: HamburgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Button */}
      <button className="hamburger-button" onClick={toggleMenu} aria-label="Menu">
        <div className={`hamburger-icon ${isOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>

      {/* Overlay */}
      {isOpen && <div className="menu-overlay" onClick={closeMenu}></div>}

      {/* Slide-out Menu */}
      <div className={`menu-drawer ${isOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <h2>Menu</h2>
          <button className="close-button" onClick={closeMenu} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="menu-content">
          {children}
        </div>
      </div>
    </>
  );
}

export default HamburgerMenu;
