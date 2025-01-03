
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
    session({
        secret: 'your-secret-key',
        resave: true,
        saveUninitialized: true,
    })
);

// Connect to MongoDB
const uri = 'mongodb://localhost:27017/ameen';
mongoose
    .connect(uri)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
});
const User = mongoose.model('User', userSchema);

// Set up views
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes

// Login Page
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/user');
    } else {
        res.render('login', { error: null });
    }
});

// Login Handler
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        console.log('user',user)
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('password matched',isPasswordValid)
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }
        req.session.user = { _id: user._id, username: user.username };
        return res.json({ success: true, redirecturl: '/user' });
    } catch (err) {
        console.error('Error during login:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Signup Page
app.get('/sign', (req, res) => {
    res.render('sign', { error: null });
});

// Signup Handler
app.post('/sign', async (req, res) => {
    const { username, email, password } = req.body;
    console.log(req.body);
    
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('sign', { error: 'Email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        req.session.user = { _id: newUser._id, username: newUser.username };
        res.redirect('/user');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }

    
});

// User Dashboard
app.get('/user', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    const user = await User.findById(req.session.user._id);
    if (!user) return res.redirect('/');
    res.render('user', { user });
});


// Render edit form
app.get('/users/:userId/edit', async (req, res) => {
    try {
        const userId = req.params.userId;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).send('User not found');
        }

        res.render('edit', { user: user, error: null });
    } catch (error) {
        console.error('Error rendering edit page:', error);
        res.status(500).send('Internal Server Error');
    }
});




// Handle edit form submission
app.post('/users/:userId/edit', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send('Unauthorized');
        }

        const { username, email, password } = req.body;
        const userId = req.session.user._id;

        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).send('User not found');
        }

        if (user._id.toString() !== userId.toString()) {
            return res.status(401).send('Unauthorized');
        }

        // Update user fields 
        if (username) {
            user.username = username;
        }
        if (email) {
            user.email = email;
        }
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user.password = hashedPassword;
        }

        await user.save();

        res.redirect('/user');
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).send('Internal Server Error');
    }
});





// Handle user deletion
app.post('/users/delete', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send('Unauthorized');
        }

        const userId = req.body.userId;
        const deletedUser = await User.findByIdAndDelete(userId);

        if (!deletedUser) {
            return res.status(404).send('User not found');
        }

        req.session.destroy();
    
        res.redirect('/');
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// Start Server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
