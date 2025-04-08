import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background-color: #f8f9fa;
`;

const Logo = styled.div`
  margin-bottom: 20px;
  text-align: center;
  
  svg {
    width: 80px;
    height: 80px;
    fill: #00C853;
  }
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 10px;
  color: #1a1a1a;
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 40px;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const CardTitle = styled.h2`
  font-size: 1.5rem;
  margin-bottom: 20px;
  color: #1a1a1a;
`;

const OptionsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
`;

const Option = styled.div`
  border: 2px solid ${props => props.selected ? '#00C853' : '#e0e0e0'};
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: #00C853;
  }

  svg {
    width: 24px;
    height: 24px;
    margin-bottom: 10px;
  }
`;

const ContinueButton = styled.button`
  width: 100%;
  padding: 15px;
  background-color: #757575;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:enabled {
    background-color: #00C853;
  }

  &:enabled:hover {
    background-color: #00B84D;
  }
`;

const Footer = styled.footer`
  text-align: center;
  margin-top: 40px;
  color: #666;
`;

const RoleSelection = () => {
  const [selectedRole, setSelectedRole] = React.useState(null);
  const navigate = useNavigate();

  const handleContinue = () => {
    if (selectedRole) {
      navigate(`/auth/${selectedRole}`);
    }
  };

  return (
    <Container>
      {/* <Logo>
        <svg viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </Logo> */}
      <Title>TaxiMax</Title>
      <Subtitle>Optimize Your Ride Experience</Subtitle>

      <Card>
        <CardTitle>Choose Your Role</CardTitle>
        <p style={{ marginBottom: '20px', color: '#666' }}>Are you looking for a ride or ready to drive?</p>
        
        <OptionsContainer>
          <Option 
            selected={selectedRole === 'rider'}
            onClick={() => setSelectedRole('rider')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
            <div>I need a ride</div>
          </Option>
          
          <Option 
            selected={selectedRole === 'driver'}
            onClick={() => setSelectedRole('driver')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-5h14v5z"/>
            </svg>
            <div>I want to drive</div>
          </Option>
        </OptionsContainer>

        <ContinueButton 
          onClick={handleContinue}
          disabled={!selectedRole}
        >
          Continue
        </ContinueButton>
      </Card>

      <Footer>
        © 2024 TaxiMax. All rights reserved.
      </Footer>
    </Container>
  );
};

export default RoleSelection; 