import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

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
  margin-bottom: 0px;
  color: #1a1a1a;
`;

const RoleIndicator = styled.div`
  font-size: 1.2rem;
  color: #00C853;
  margin-bottom: 20px;
  text-transform: capitalize;
  text-align: center;
  font-weight: bold;
`;

const SwitchRoleButton = styled.button`
  background: none;
  border: none;
  color: #666;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 20px;
  text-decoration: underline;
  text-align: center;

  &:hover {
    color: #00C853;
  }
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  color: #666;
  margin-top: 0px;
  margin-bottom: 30px;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 0.9rem;
  color: #666;
`;

const Input = styled.input`
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;

  &:focus {
    border-color: #00C853;
    outline: none;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 15px;
  background-color: #00C853;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #00B84D;
  }

  &:disabled {
    background-color: #757575;
    cursor: not-allowed;
  }
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: #00C853;
  font-size: 1rem;
  cursor: pointer;
  padding: 0;
  margin-top: 20px;

  &:hover {
    text-decoration: underline;
  }
`;

const ErrorMessage = styled.div`
  color: #d32f2f;
  font-size: 0.9rem;
  margin-top: 10px;
`;

const Footer = styled.footer`
  text-align: center;
  margin-top: 40px;
  color: #666;
`;

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phoneNumber: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { role } = useParams();

  const handleSwitchRole = () => {
    const newRole = role === 'rider' ? 'driver' : 'rider';
    navigate(`/auth/${newRole}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const data = isLogin 
        ? { email: formData.email, password: formData.password }
        : { ...formData, role };

      const response = await axios.post(endpoint, data);
      
      // Store token and user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Redirect based on role
      navigate(role === 'rider' ? '/rider' : '/driver');
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
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
        <RoleIndicator>{role === 'rider' ? 'User Sign in' : 'Driver Sign in'}</RoleIndicator>
        

        <Form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <FormGroup>
                <Label>Full Name</Label>
                <Input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </FormGroup>
              <FormGroup>
                <Label>Phone Number</Label>
                <Input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                />
              </FormGroup>
            </>
          )}
          <FormGroup>
            <Label>Email</Label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </FormGroup>
          <FormGroup>
            <Label>Password</Label>
            <Input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </FormGroup>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
          </Button>
        </Form>

        <ToggleButton type="button" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
        </ToggleButton>
          <br></br>

        <SwitchRoleButton onClick={handleSwitchRole} style={{ alignSelf: 'left' }}>
          Switch to {role === 'rider' ? 'Driver' : 'User'} account
        </SwitchRoleButton>
      </Card>

      <Footer>
        © 2024 TaxiMax. All rights reserved.
      </Footer>
    </Container>
  );
};

export default Login; 