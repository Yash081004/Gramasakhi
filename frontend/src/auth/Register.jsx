import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, UserCircle } from 'lucide-react';
import { Button, Input, Card, Alert } from '../components/UIComponents';
import { authAPI } from '../api';

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
  };

  const validateUsername = (username) => {
    const re = /^[a-zA-Z0-9_]+$/;
    return re.test(username);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!formData.username || !formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('All fields are required.');
      setLoading(false);
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    if (!validateUsername(formData.username)) {
      setError('Username can only contain letters, numbers, and underscores.');
      setLoading(false);
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters long.');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    try {
      await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName,
      });

      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.detail || err.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-40 w-80 h-80 bg-primary-300 rounded-full opacity-10 blur-3xl" />
        <div className="absolute bottom-0 -right-40 w-80 h-80 bg-secondary-300 rounded-full opacity-10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-gradient-to-br from-primary-600 to-secondary-500 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/30">
            <span className="text-white font-bold text-lg">GS</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">GramSakhi</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Create your account to get started</p>
        </div>

        <Card className="p-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Create an account
          </h2>

          {error && <Alert variant="error" message={error} className="mb-4" />}
          {success && <Alert variant="success" message={success} className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input 
              icon={UserCircle} 
              name="username" 
              placeholder="Username (letters, numbers, _)" 
              value={formData.username} 
              onChange={handleChange} 
              disabled={loading} 
              autoComplete="username"
            />
            <Input 
              icon={User} 
              name="fullName" 
              placeholder="Full Name" 
              value={formData.fullName} 
              onChange={handleChange} 
              disabled={loading} 
              autoComplete="name"
            />
            <Input 
              icon={Mail} 
              type="email" 
              name="email" 
              placeholder="Email Address" 
              value={formData.email} 
              onChange={handleChange} 
              disabled={loading} 
              autoComplete="email"
            />
            <Input 
              icon={Lock} 
              type="password" 
              name="password" 
              placeholder="Password (min 8 characters)" 
              value={formData.password} 
              onChange={handleChange} 
              disabled={loading} 
              autoComplete="new-password"
            />
            <Input 
              icon={Lock} 
              type="password" 
              name="confirmPassword" 
              placeholder="Confirm Password" 
              value={formData.confirmPassword} 
              onChange={handleChange} 
              disabled={loading} 
              autoComplete="new-password"
            />

            <Button fullWidth type="submit" disabled={loading} className="mt-2">
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
            Already have an account? 
            <Link to="/login" className="text-primary-600 dark:text-primary-400 font-semibold ml-1 hover:underline transition-colors">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}