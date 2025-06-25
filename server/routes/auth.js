const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secure-secret-key';

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Register a new user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  try {
    // Check if user already exists
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], async (err, user) => {
      if (err) {
        console.error('Database error during registration:', err);
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (user) {
        return res.status(400).json({ message: 'Username or email already exists' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      // Insert new user
      db.run(
        'INSERT INTO users (id, username, email, password, status) VALUES (?, ?, ?, ?, ?)',
        [userId, username, email, hashedPassword, 'online'],
        (err) => {
          if (err) {
            console.error('Error creating user:', err);
            return res.status(500).json({ message: 'Error creating user', error: err.message });
          }
          
          // Generate JWT token
          const token = jwt.sign(
            { id: userId, username },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          
          res.status(201).json({
            message: 'User created successfully',
            user: { id: userId, username, email, status: 'online' },
            token
          });
        }
      );
    });
  } catch (error) {
    console.error('Server error during registration:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  
  try {
    // Find user by email
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Database error during login:', err);
        return res.status(500).json({ message: 'Database error', error: err.message });
      }
      
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Check password
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Update user status to online
      db.run('UPDATE users SET status = ? WHERE id = ?', ['online', user.id]);
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          status: 'online'
        },
        token
      });
    });
  } catch (error) {
    console.error('Server error during login:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user profile
router.get('/profile', verifyToken, (req, res) => {
  db.get('SELECT id, username, email, status FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      console.error('Database error fetching profile:', err);
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user });
  });
});

// Logout
router.post('/logout', verifyToken, (req, res) => {
  // Update user status to offline
  db.run('UPDATE users SET status = ? WHERE id = ?', ['offline', req.user.id], (err) => {
    if (err) {
      console.error('Database error during logout:', err);
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = {
  router,
  verifyToken
};
