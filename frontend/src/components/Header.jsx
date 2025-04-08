import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  background-color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  
  svg {
    width: 32px;
    height: 32px;
    fill: #00C853;
  }
`;

const LogoText = styled.h1`
  font-size: 1.5rem;
  color: #1a1a1a;
  margin: 0;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;

const UserDetails = styled.div`
  text-align: right;
`;

const UserName = styled.div`
  font-weight: 500;
  color: #1a1a1a;
`;

const UserRole = styled.div`
  font-size: 0.875rem;
  color: #666;
  text-transform: capitalize;
`;

const SignOutButton = styled.button`
  background-color: #f5f5f5;
  color: #1a1a1a;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #e0e0e0;
  }
`;

const Header = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <HeaderContainer>
      <Logo>
        {/* <svg viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg> */}
        <LogoText>TaxiMax</LogoText>
      </Logo>
      
      <UserInfo>
        <UserDetails>
          <UserName>{user.fullName}</UserName>
          <UserRole>{user.role}</UserRole>
        </UserDetails>
        <SignOutButton onClick={handleSignOut}>
          Sign Out
        </SignOutButton>
      </UserInfo>
    </HeaderContainer>
  );
};

export default Header; 