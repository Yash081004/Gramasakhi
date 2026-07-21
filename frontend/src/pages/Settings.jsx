import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Badge } from '../components/UIComponents';
import { Lock, Bell, Zap, Info, ChevronRight } from 'lucide-react';
import { authAPI, userAPI } from '../api/client';

export default function Settings() {
  const [profile, setProfile] = useState({
    name: 'User',
    email: 'user@example.com',
  });
  const [preferences, setPreferences] = useState({
    aiModel: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  });
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    chatAlerts: true,
    uploadReminders: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const user = await userAPI.getProfile();
      if (user) setProfile(user);
      const prefs = await userAPI.getPreferences();
      if (prefs) setPreferences(prefs);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      await userAPI.updateProfile(profile);
      alert('Profile updated successfully');
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    try {
      await userAPI.updatePreferences(preferences);
      alert('Preferences saved successfully');
    } catch (err) {
      console.error('Failed to save preferences:', err);
      alert('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    const current = prompt('Current password:');
    const newPass = prompt('New password:');
    const confirm = prompt('Confirm new password:');

    if (!current || !newPass || !confirm) return;
    if (newPass !== confirm) {
      alert('Passwords do not match');
      return;
    }

    try {
      await authAPI.changePassword(current, newPass);
      alert('Password changed successfully');
    } catch (err) {
      console.error('Failed to change password:', err);
      alert('Failed to change password: ' + err.message);
    }
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">Manage your account and preferences</p>
      </motion.div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-5 w-5 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h2>
        </div>

        <Card className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <Button onClick={saveProfile} loading={loading} className="w-full">
            Save Profile
          </Button>
        </Card>
      </motion.div>

      {/* Security Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Security</h2>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Change Password</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Update your password regularly</p>
            </div>
            <Button onClick={changePassword} variant="secondary" size="sm">
              Change
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Two-Factor Auth</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Add extra security to your account</p>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </Card>
      </motion.div>

      {/* AI Preferences Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-yellow-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Preferences</h2>
        </div>

        <Card className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI Model
            </label>
            <select
              value={preferences.aiModel}
              onChange={(e) => setPreferences({ ...preferences, aiModel: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5">GPT-3.5</option>
              <option value="claude">Claude</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Temperature: {preferences.temperature.toFixed(2)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={preferences.temperature}
              onChange={(e) =>
                setPreferences({ ...preferences, temperature: parseFloat(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Higher values make outputs more random
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Tokens: {preferences.maxTokens}
            </label>
            <input
              type="range"
              min="100"
              max="4000"
              step="100"
              value={preferences.maxTokens}
              onChange={(e) =>
                setPreferences({ ...preferences, maxTokens: parseInt(e.target.value) })
              }
              className="w-full"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Maximum length of responses
            </p>
          </div>

          <Button onClick={savePreferences} loading={loading} className="w-full">
            Save Preferences
          </Button>
        </Card>
      </motion.div>

      {/* Notifications Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-green-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h2>
        </div>

        <Card className="p-6 space-y-4">
          {[
            { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
            { key: 'chatAlerts', label: 'Chat Alerts', desc: 'Get notified about new messages' },
            { key: 'uploadReminders', label: 'Upload Reminders', desc: 'Remind me to upload documents' },
          ].map((option) => (
            <div key={option.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{option.label}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{option.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={notifications[option.key]}
                onChange={(e) =>
                  setNotifications({ ...notifications, [option.key]: e.target.checked })
                }
                className="h-5 w-5 text-blue-500 rounded cursor-pointer"
              />
            </div>
          ))}
        </Card>
      </motion.div>

      {/* About Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      >
        <Card className="p-6 bg-gradient-to-r from-blue-500/10 to-blue-600/10 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">GramSakhi v1.0</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Intelligent Document Management</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
